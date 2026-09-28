const test = require('node:test');
const assert = require('node:assert/strict');
const { EditorSession } = require('../miniprogram/services/editor-session');
const { Repository, KEYS } = require('../miniprogram/services/repository');
const { createDocument, createElement } = require('../miniprogram/core/document');

function fixture() {
  const values = new Map();
  const api = {
    getStorageSync(key) { return values.has(key) ? structuredClone(values.get(key)) : ''; },
    setStorageSync(key, value) { values.set(key, structuredClone(value)); },
    removeStorageSync(key) { values.delete(key); }
  };
  const repository = new Repository(api);
  return { api, values, repository, session: new EditorSession(repository) };
}

function label(name) {
  const document = createDocument(40, 12);
  document.name = name;
  document.elements = [createElement('text', document)];
  document.elements[0].text = name;
  return document;
}

test('a cold restart restores the exact unsaved session including its project association', () => {
  const { api, session } = fixture();
  session.checkpoint(label('待完成'), 'p-original', true);
  const restarted = new EditorSession(new Repository(api));
  const state = restarted.open({});
  assert.equal(state.document.elements[0].text, '待完成');
  assert.equal(state.projectId, 'p-original');
  assert.equal(state.dirtySinceSave, true);
  assert.equal(restarted.recoverable().document.name, '待完成');
});

test('opening another template cannot silently overwrite work', () => {
  const { session, repository } = fixture();
  session.checkpoint(label('原草稿'), '', true);
  assert.throws(() => session.stage(label('新模板'), ''), { code: 'EDITOR_DRAFT_PENDING' });
  assert.equal(repository.getEditorDraft(), null);
  assert.equal(session.recoverable().document.name, '原草稿');
});

test('saving recovery permits a new task and preserves the previous label', () => {
  const { session, repository } = fixture();
  session.checkpoint(label('旧任务'), '', true);
  session.saveRecovery();
  session.stage(label('新任务'), '');
  assert.equal(session.open({}).document.name, '新任务');
  assert.equal(repository.getProjects()[0].document.name, '旧任务');
  assert.equal(repository.getEditorDraft(), null);
});

test('a stale handoff loses to newer dirty autosave after interruption', () => {
  const { session, repository } = fixture();
  repository.saveEditorDraft({ document: label('过期入口'), projectId: '' });
  session.checkpoint(label('新修改'), '', true);
  assert.equal(session.open({}).document.name, '新修改');
});

test('failed checkpoint does not consume the navigation handoff', () => {
  const { session, repository, api } = fixture();
  session.stage(label('不能丢失'), '');
  const set = api.setStorageSync;
  api.setStorageSync = (key, value) => {
    if (key === KEYS.editorAutosave) throw new Error('quota');
    set(key, value);
  };
  assert.throws(() => session.open({}), { code: 'STORAGE_WRITE_FAILED' });
  assert.equal(repository.getEditorDraft().document.name, '不能丢失');
  api.setStorageSync = set;
  assert.equal(session.open({}).document.name, '不能丢失');
});

test('explicit discard removes both drafts without changing the saved project', () => {
  const { session, repository } = fixture();
  const saved = repository.saveProject(label('已保存'));
  session.checkpoint(label('未保存修改'), saved.id, true);
  session.resume();
  session.discard();
  assert.equal(repository.getEditorAutosave(), null);
  assert.equal(repository.getEditorDraft(), null);
  assert.equal(repository.getProjects()[0].document.name, '已保存');
});

test('failed discard retains the durable draft for retry', () => {
  const { session, api } = fixture();
  session.checkpoint(label('草稿'), '', true);
  api.removeStorageSync = () => { throw new Error('storage busy'); };
  assert.throws(() => session.discard(), { code: 'STORAGE_REMOVE_FAILED' });
  assert.equal(session.recoverable().document.name, '草稿');
});

test('fresh direct editor access starts with empty paper matching the default device', () => {
  const { session, repository } = fixture();
  const state = session.open(repository.getSettings());
  assert.equal(state.document.widthMm, 40);
  assert.equal(state.document.heightMm, 12);
  assert.equal(state.document.elements.length, 0);
  assert.equal(state.dirtySinceSave, false);
});
