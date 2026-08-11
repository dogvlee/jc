const { categories, industries, templates } = require('../../app/catalog');
const { applyRowToDocument } = require('../../app/data-bind');
const { buildTemplateDocument } = require('../../app/template-layouts');
const { STOCK_PRESETS } = require('../../app/stock-presets');
const { createDocument } = require('../../core/document');
const { importNiimTemplate } = require('../../core/niim-template-import');
const { getProfile } = require('../../core/profiles');
const { buildScanDocument } = require('../../core/scan-label');
const { validateDocument } = require('../../core/renderer');
const { parseCsv, rowsToRecords, stringifyCsv } = require('../../services/csv');
const { KEYS, Repository, normalizeDocument } = require('../../services/repository');
const { scanCode } = require('../../services/scanner');

const PAGE_SIZE = 24;
const DATA_COLUMNS = ['name', 'code', 'price', 'date'];
const MAX_CSV_IMPORT_BYTES = 2 * 1024 * 1024;
const MAX_BACKUP_IMPORT_BYTES = 5 * 1024 * 1024;
const MAX_TEMPLATE_IMPORT_BYTES = 2 * 1024 * 1024;
const ROUTE_TITLES = {
  home: '精臣标签',
  templates: '行业模板',
  projects: '我的标签',
  data: '批量数据',
  profile: '我的'
};

function templateView(item) {
  return {
    id: item.id,
    name: item.name,
    category: item.category || '我的',
    industry: item.industry || '我的',
    sizeText: `${item.size[0]}×${item.size[1]} mm`,
    blurb: item.blurb || '我的本地模板',
    badge: item.badge || '',
    kind: item.kind || 'accent',
    source: item.source || 'catalog',
    thumbSrc: item.thumbSrc ? `/${String(item.thumbSrc).replace(/^\/+/, '')}` : ''
  };
}

function projectView(item) {
  const document = item.document || {};
  const elements = Array.isArray(document.elements) ? document.elements : [];
  let kind = 'accent';
  if (elements.some((element) => element.type === 'qrcode')) kind = 'qr';
  else if (elements.some((element) => element.type === 'barcode')) kind = 'barcode';
  return {
    id: item.id,
    name: item.name || document.name || '未命名标签',
    sizeText: `${document.widthMm || 40}×${document.heightMm || 30} mm`,
    updatedText: formatRelativeTime(item.updatedAt),
    kind
  };
}

function formatRelativeTime(value) {
  const timestamp = Number(value) || 0;
  if (!timestamp) return '';
  const date = new Date(timestamp);
  const now = new Date();
  if (date.toDateString() === now.toDateString()) {
    return `今天 ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  }
  return `${date.getMonth() + 1}月${date.getDate()}日`;
}

Page({
  data: {
    route: 'home',
    routeTitle: ROUTE_TITLES.home,
    safeTop: 24,
    connected: false,
    connectionLabel: '未连接',
    categories,
    industries,
    templateCategory: '全部',
    templateIndustry: '全部',
    templateQuery: '',
    templateVisibleCount: PAGE_SIZE,
    templateTotal: templates.length,
    visibleTemplates: [],
    recentProjects: [],
    allProjects: [],
    recommendedTemplates: templates.slice(0, 4).map(templateView),
    userTemplateCount: 0,
    dataRows: [],
    printHistory: [],
    settings: {},
    densityMin: 1,
    densityMax: 5,
    codeScanning: false,
    showOnboarding: false,
    onboardingStep: 0,
    showTemplatePreview: false,
    previewTemplate: null,
    showStockSheet: false,
    showHistorySheet: false,
    showSettingsSheet: false,
    showHelpSheet: false,
    projectQuery: '',
    batchTemplateId: 'product-simple',
    labelTypeNames: ['间隙纸', '黑标纸', '连续纸', '定孔纸'],
    stockPresets: STOCK_PRESETS,
    batchTemplateNames: templates.slice(0, 32).map((item) => item.name),
    batchTemplateIndex: 0
  },

  onLoad() {
    const info = wx.getWindowInfo ? wx.getWindowInfo() : wx.getSystemInfoSync();
    this.repository = new Repository(wx);
    this.repository.migrate();
    this.setData({ safeTop: Number(info.safeArea && info.safeArea.top) || Number(info.statusBarHeight) || 24 });
    this.bindConnectionState();
    this.refresh();
  },

  onShow() {
    if (this.repository) this.refresh();
  },

  onUnload() {
    if (this.removeConnectionListener) this.removeConnectionListener();
  },

  onPullDownRefresh() {
    this.refresh();
    wx.stopPullDownRefresh();
  },

  bindConnectionState() {
    const app = getApp();
    const manager = app && app.globalData && app.globalData.connectionManager;
    if (!manager || typeof manager.subscribe !== 'function') return;
    this.removeConnectionListener = manager.subscribe((state) => {
      const connected = state.status === 'connected';
      this.setData({
        connected,
        connectionLabel: connected ? ((state.device && (state.device.name || state.device.displayName)) || '已连接') : '未连接'
      });
    });
    if (typeof manager.getState === 'function') {
      const state = manager.getState();
      const connected = state.status === 'connected';
      this.setData({ connected, connectionLabel: connected ? ((state.device && (state.device.name || state.device.displayName)) || '已连接') : '未连接' });
    }
  },

  refresh() {
    const projects = this.repository.getProjects();
    const userTemplates = this.repository.getUserTemplates();
    const settings = this.repository.getSettings();
    const profile = getProfile(settings.defaultProfileId);
    const dataRows = this.repository.getDataRows();
    const printHistory = this.repository.getPrintHistory();
    this.projects = projects;
    this.userTemplates = userTemplates;
    this.printHistoryRecords = printHistory;
    this.setData({
      settings,
      densityMin: profile.densityMin,
      densityMax: profile.densityMax,
      recentProjects: projects.slice(0, 4).map(projectView),
      allProjects: this.filteredProjectViews(projects),
      userTemplateCount: userTemplates.length,
      dataRows,
      printHistory: printHistory.slice(0, 20).map((item) => ({
        id: item.id,
        name: item.name || '未命名标签',
        result: item.result || 'unknown',
        atText: formatRelativeTime(item.at),
        message: item.message || '',
        canOpen: Boolean(item.document)
      })),
      showOnboarding: !settings.onboardingDone
    });
    this.refreshTemplates();
  },

  filteredProjectViews(projects) {
    const query = String(this.data.projectQuery || '').trim().toLowerCase();
    return (projects || []).filter((item) => !query || String(item.name || '').toLowerCase().includes(query)).map(projectView);
  },

  refreshTemplates() {
    const category = this.data.templateCategory;
    const industry = this.data.templateIndustry;
    const query = String(this.data.templateQuery || '').trim().toLowerCase();
    const systemItems = templates.map((item) => Object.assign({ source: item.source || 'catalog' }, item));
    const userItems = (this.userTemplates || []).map((item) => ({
      id: item.id,
      name: item.name,
      category: '我的',
      industry: '我的',
      size: [item.document.widthMm, item.document.heightMm],
      kind: projectView(item).kind,
      blurb: '保存在本机的自定义模板',
      source: 'user'
    }));
    const source = industry === '我的' ? userItems : systemItems.concat(userItems);
    const filtered = source.filter((item) => {
      if (category !== '全部' && item.category !== category) return false;
      if (industry !== '全部' && industry !== '我的' && item.industry !== industry) return false;
      if (!query) return true;
      return [item.name, item.category, item.industry, item.blurb].some((value) => String(value || '').toLowerCase().includes(query));
    });
    this.filteredTemplates = filtered;
    this.setData({
      templateTotal: filtered.length,
      visibleTemplates: filtered.slice(0, this.data.templateVisibleCount).map(templateView)
    });
  },

  navigate(event) {
    const route = event.currentTarget.dataset.route;
    if (!ROUTE_TITLES[route]) return;
    this.setData({ route, routeTitle: ROUTE_TITLES[route] }, () => {
      if (route === 'templates') this.refreshTemplates();
      if (route === 'projects') this.setData({ allProjects: this.filteredProjectViews(this.projects) });
    });
  },

  openIndustry() {
    this.setData({ route: 'templates', routeTitle: ROUTE_TITLES.templates, templateIndustry: '全部' }, () => this.refreshTemplates());
  },

  setTemplateCategory(event) {
    this.setData({ templateCategory: event.currentTarget.dataset.value, templateVisibleCount: PAGE_SIZE }, () => this.refreshTemplates());
  },

  setTemplateIndustry(event) {
    this.setData({ templateIndustry: event.currentTarget.dataset.value, templateVisibleCount: PAGE_SIZE }, () => this.refreshTemplates());
  },

  onTemplateSearch(event) {
    this.setData({ templateQuery: event.detail.value, templateVisibleCount: PAGE_SIZE }, () => this.refreshTemplates());
  },

  resetTemplateFilters() {
    this.setData({ templateCategory: '全部', templateIndustry: '全部', templateQuery: '', templateVisibleCount: PAGE_SIZE }, () => this.refreshTemplates());
  },

  loadMoreTemplates() {
    this.setData({ templateVisibleCount: this.data.templateVisibleCount + PAGE_SIZE }, () => this.refreshTemplates());
  },

  resolveTemplate(id) {
    const user = (this.userTemplates || []).find((item) => item.id === id);
    if (user) return { meta: templateView({
      id: user.id,
      name: user.name,
      category: '我的',
      industry: '我的',
      size: [user.document.widthMm, user.document.heightMm],
      kind: projectView(user).kind,
      source: 'user'
    }), document: user.document };
    const meta = templates.find((item) => item.id === id);
    if (!meta) return null;
    return { meta: templateView(meta), document: buildTemplateDocument(meta) };
  },

  previewTemplate(event) {
    const resolved = this.resolveTemplate(event.currentTarget.dataset.id);
    if (!resolved) return;
    const counts = {};
    (resolved.document.elements || []).forEach((element) => { counts[element.type] = (counts[element.type] || 0) + 1; });
    resolved.meta.elementSummary = Object.keys(counts).map((key) => `${key}×${counts[key]}`).join(' · ');
    resolved.meta.elementCount = resolved.document.elements.length;
    this.previewDocument = resolved.document;
    this.setData({ showTemplatePreview: true, previewTemplate: resolved.meta });
  },

  closeTemplatePreview() {
    this.previewDocument = null;
    this.setData({ showTemplatePreview: false, previewTemplate: null });
  },

  usePreviewTemplate() {
    if (!this.previewDocument) return;
    this.openEditor(this.previewDocument, '');
  },

  deletePreviewTemplate() {
    const preview = this.data.previewTemplate;
    if (!preview || preview.source !== 'user') return;
    wx.showModal({
      title: '删除我的模板',
      content: `确定删除“${preview.name}”吗？已用它创建的项目不会被删除。`,
      confirmColor: '#e53935',
      success: (result) => {
        if (!result.confirm) return;
        this.repository.deleteUserTemplate(preview.id);
        this.closeTemplatePreview();
        this.refresh();
        wx.showToast({ title: '模板已删除', icon: 'success' });
      }
    });
  },

  createBlank() {
    const settings = this.repository.getSettings();
    const document = createDocument(Number(settings.stockWidthMm) || 50, Number(settings.stockHeightMm) || 30);
    document.name = '未命名标签';
    document.elements = [];
    this.openEditor(document, '');
  },

  createWifiLabel() {
    const meta = templates.find((item) => item.id === 'wifi-code');
    if (meta) this.openEditor(buildTemplateDocument(meta), '');
  },

  async scanToLabel() {
    if (this.codeScanInFlight) return;
    this.codeScanInFlight = true;
    this.setData({ codeScanning: true });
    try {
      const result = await scanCode(wx);
      const settings = this.repository.getSettings();
      const document = buildScanDocument(result, {
        widthMm: settings.stockWidthMm,
        heightMm: settings.stockHeightMm
      });
      this.openEditor(document, '');
    } catch (error) {
      if (error && error.code === 'SCAN_CANCELLED') return;
      wx.showModal({
        title: '无法扫码建标',
        content: error && error.message ? error.message : '扫码失败，请稍后重试',
        showCancel: false
      });
    } finally {
      this.codeScanInFlight = false;
      this.setData({ codeScanning: false });
    }
  },

  openProject(event) {
    const project = (this.projects || []).find((item) => item.id === event.currentTarget.dataset.id);
    if (project) this.openEditor(project.document, project.id);
  },

  openEditor(document, projectId) {
    try {
      wx.setStorageSync(KEYS.editorDraft, {
        document,
        projectId: projectId || '',
        returnRoute: this.data.route,
        openedAt: Date.now()
      });
      wx.navigateTo({ url: '/pages/editor/index' });
    } catch (error) {
      wx.showModal({ title: '无法打开编辑器', content: error.message || '本地存储空间不足', showCancel: false });
    }
  },

  deleteProject(event) {
    const id = event.currentTarget.dataset.id;
    const project = (this.projects || []).find((item) => item.id === id);
    wx.showModal({
      title: '删除标签',
      content: `确定删除“${project ? project.name : '此标签'}”吗？此操作不可撤销。`,
      success: (result) => {
        if (!result.confirm) return;
        this.repository.deleteProject(id);
        this.refresh();
      }
    });
  },

  onProjectSearch(event) {
    this.setData({ projectQuery: event.detail.value }, () => {
      this.setData({ allProjects: this.filteredProjectViews(this.projects) });
    });
  },

  openStockSheet() { this.setData({ showStockSheet: true }); },
  closeStockSheet() { this.setData({ showStockSheet: false }); },
  openHistorySheet() { this.setData({ showHistorySheet: true }); },
  closeHistorySheet() { this.setData({ showHistorySheet: false }); },
  openSettingsSheet() { this.setData({ showSettingsSheet: true }); },
  closeSettingsSheet() { this.setData({ showSettingsSheet: false }); },
  openHelp() { this.setData({ showHelpSheet: true }); },
  closeHelp() { this.setData({ showHelpSheet: false }); },

  openHistoryItem(event) {
    const record = (this.printHistoryRecords || []).find((item) => item.id === event.currentTarget.dataset.id);
    if (!record || !record.document) {
      wx.showToast({ title: '较早记录只保留结果，不再保存标签副本', icon: 'none' });
      return;
    }
    this.setData({ showHistorySheet: false });
    this.openEditor(record.document, record.projectId || '');
  },

  updateStockField(event) {
    const field = event.currentTarget.dataset.field;
    const value = Number(event.detail.value);
    if (!Number.isFinite(value) || value < 5 || value > 150) {
      wx.showToast({ title: '标签尺寸须在 5-150 mm', icon: 'none' });
      this.setData({ settings: this.repository.getSettings() });
      return;
    }
    const settings = Object.assign({}, this.data.settings, { [field]: value });
    this.repository.saveSettings({ [field]: value });
    this.setData({ settings });
  },

  chooseStockPreset(event) {
    const value = String(event.currentTarget.dataset.value || '').split('x').map(Number);
    if (value.length !== 2 || value.some((item) => !Number.isFinite(item))) return;
    const settings = this.repository.saveSettings({ stockWidthMm: value[0], stockHeightMm: value[1] });
    this.setData({ settings, showStockSheet: false });
  },

  updateSetting(event) {
    const field = event.currentTarget.dataset.field;
    let value = event.detail.value;
    if (['density', 'threshold', 'labelType'].includes(field)) value = Number(value);
    if (field === 'density') value = Math.max(this.data.densityMin, Math.min(this.data.densityMax, value));
    const settings = this.repository.saveSettings({ [field]: value });
    this.setData({ settings });
  },

  finishOnboarding() {
    const settings = this.repository.saveSettings({ onboardingDone: true });
    this.setData({ showOnboarding: false, settings });
  },

  nextOnboarding() {
    if (this.data.onboardingStep >= 2) this.finishOnboarding();
    else this.setData({ onboardingStep: this.data.onboardingStep + 1 });
  },

  skipOnboarding() { this.finishOnboarding(); },

  updateDataCell(event) {
    const index = Number(event.currentTarget.dataset.index);
    const field = event.currentTarget.dataset.field;
    const rows = this.data.dataRows.slice();
    if (!rows[index] || !DATA_COLUMNS.includes(field)) return;
    rows[index] = Object.assign({}, rows[index], { [field]: event.detail.value });
    this.repository.saveDataRows(rows);
    this.setData({ dataRows: rows });
  },

  addDataRow() {
    const rows = this.data.dataRows.concat({ id: `row-${Date.now().toString(36)}`, name: '', code: '', price: '', date: '' });
    this.repository.saveDataRows(rows);
    this.setData({ dataRows: rows });
  },

  removeDataRow(event) {
    const index = Number(event.currentTarget.dataset.index);
    const rows = this.data.dataRows.filter((item, itemIndex) => itemIndex !== index);
    this.repository.saveDataRows(rows);
    this.setData({ dataRows: rows });
  },

  onBatchTemplateChange(event) {
    const index = Number(event.detail.value) || 0;
    const item = templates.slice(0, 32)[index];
    this.setData({ batchTemplateIndex: index, batchTemplateId: item ? item.id : 'product-simple' });
  },

  runBatch() {
    const meta = templates.find((item) => item.id === this.data.batchTemplateId) || templates[0];
    const rows = this.data.dataRows.filter((row) => DATA_COLUMNS.some((field) => String(row[field] || '').trim()));
    if (!rows.length) {
      wx.showToast({ title: '请先填写至少一行数据', icon: 'none' });
      return;
    }
    const profile = getProfile(this.repository.getSettings().defaultProfileId);
    const documents = [];
    for (let index = 0; index < rows.length; index += 1) {
      try {
        const document = applyRowToDocument(buildTemplateDocument(meta), rows[index]);
        validateDocument(document, profile.dpi);
        documents.push(document);
      } catch (error) {
        wx.showModal({
          title: `第 ${index + 1} 行无法生成`,
          content: error.message || '数据不符合模板要求；尚未创建任何项目。',
          showCancel: false
        });
        return;
      }
    }
    let created;
    try {
      created = this.repository.saveProjects(documents);
    } catch (error) {
      wx.showModal({ title: '批量保存失败', content: error.message || '本机存储空间不足，未写入本批项目。', showCancel: false });
      return;
    }
    const first = created[0] || null;
    this.refresh();
    wx.showToast({ title: `已生成 ${rows.length} 个标签`, icon: 'success' });
    if (first) setTimeout(() => this.openEditor(first.document, first.id), 350);
  },

  importCsv() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['csv'],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file) return;
        if (Number(file.size) > MAX_CSV_IMPORT_BYTES) {
          wx.showToast({ title: 'CSV 文件不能超过 2 MiB', icon: 'none' });
          return;
        }
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (readResult) => {
            try {
              const records = rowsToRecords(parseCsv(readResult.data), DATA_COLUMNS).map((item, index) => Object.assign({ id: `csv-${Date.now().toString(36)}-${index}` }, item));
              this.repository.saveDataRows(records);
              this.setData({ dataRows: records });
              wx.showToast({ title: `已导入 ${records.length} 行`, icon: 'success' });
            } catch (error) {
              wx.showModal({ title: 'CSV 导入失败', content: error.message, showCancel: false });
            }
          },
          fail: () => wx.showToast({ title: '读取文件失败', icon: 'none' })
        });
      }
    });
  },

  exportCsv() {
    const rows = [DATA_COLUMNS].concat(this.data.dataRows.map((item) => DATA_COLUMNS.map((field) => item[field] || '')));
    this.shareTextFile('niim-label-data.csv', stringifyCsv(rows));
  },

  exportBackup() {
    this.shareTextFile(`niim-label-backup-${Date.now()}.json`, JSON.stringify(this.repository.backup(), null, 2));
  },

  importBackup() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file) return;
        if (Number(file.size) > MAX_BACKUP_IMPORT_BYTES) {
          wx.showToast({ title: '备份文件不能超过 5 MiB', icon: 'none' });
          return;
        }
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (readResult) => {
            try {
              const payload = JSON.parse(readResult.data);
              const projectCount = Array.isArray(payload.projects) ? payload.projects.length : 0;
              const templateCount = Array.isArray(payload.templates) ? payload.templates.length : 0;
              wx.showModal({
                title: '确认恢复备份',
                content: `备份含 ${projectCount} 个项目、${templateCount} 个模板。恢复会覆盖本机现有项目、模板、数据和设置，确定继续吗？`,
                confirmText: '覆盖恢复',
                confirmColor: '#e53935',
                success: (choice) => {
                  if (!choice.confirm) return;
                  try {
                    const restored = this.repository.restore(payload);
                    this.refresh();
                    wx.showToast({ title: `已恢复 ${restored.projects} 个项目`, icon: 'success' });
                  } catch (error) {
                    wx.showModal({ title: '恢复失败', content: error.message || '备份文件无效', showCancel: false });
                  }
                }
              });
            } catch (error) {
              wx.showModal({ title: '恢复失败', content: error.message || '备份文件无效', showCancel: false });
            }
          }
        });
      }
    });
  },

  importTemplateFile() {
    wx.chooseMessageFile({
      count: 1,
      type: 'file',
      extension: ['json'],
      success: (result) => {
        const file = result.tempFiles && result.tempFiles[0];
        if (!file) return;
        if (Number(file.size) > MAX_TEMPLATE_IMPORT_BYTES) {
          wx.showToast({ title: '模板文件不能超过 2 MiB', icon: 'none' });
          return;
        }
        wx.getFileSystemManager().readFile({
          filePath: file.path,
          encoding: 'utf8',
          success: (readResult) => {
            try {
              const payload = JSON.parse(readResult.data);
              let document = normalizeDocument(payload.document || payload);
              if (!document) document = importNiimTemplate(payload).document;
              const template = this.repository.saveUserTemplate(document, payload.name || document.name || file.name);
              this.refresh();
              wx.showToast({ title: `已导入“${template.name}”`, icon: 'success' });
            } catch (error) {
              wx.showModal({ title: '模板导入失败', content: error.message || 'JSON 模板格式不受支持', showCancel: false });
            }
          },
          fail: () => wx.showToast({ title: '读取模板失败', icon: 'none' })
        });
      }
    });
  },

  shareTextFile(filename, content) {
    const filePath = `${wx.env.USER_DATA_PATH}/${filename}`;
    wx.getFileSystemManager().writeFile({
      filePath,
      data: content,
      encoding: 'utf8',
      success: () => {
        if (wx.shareFileMessage) {
          wx.shareFileMessage({ filePath, fileName: filename });
        } else {
          wx.showModal({ title: '文件已生成', content: filePath, showCancel: false });
        }
      },
      fail: () => wx.showToast({ title: '文件生成失败', icon: 'none' })
    });
  },

  openDevices() {
    const app = getApp();
    const manager = app && app.globalData && app.globalData.connectionManager;
    if (manager && typeof manager.openDevicePicker === 'function') {
      manager.openDevicePicker();
      return;
    }
    wx.navigateTo({ url: '/pages/editor/index?devices=1' });
  }
});
