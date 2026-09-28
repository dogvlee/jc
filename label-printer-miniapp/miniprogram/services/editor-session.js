const { createDocument } = require('../core/document');
const { getProfile } = require('../core/profiles');

// A navigation draft is only a handoff. The autosave is the durable session;
// never replace dirty work merely because another page opens the editor.
class EditorSession {
  constructor(repository) {
    this.repository = repository;
  }

  recoverable() {
    const draft = this.repository.getEditorAutosave();
    return draft && draft.dirtySinceSave ? draft : null;
  }

  stage(document, projectId) {
    if (this.recoverable()) {
      const error = new Error('请先继续编辑或保存上次草稿，再打开其他标签');
      error.code = 'EDITOR_DRAFT_PENDING';
      throw error;
    }
    return this.repository.saveEditorDraft({ document, projectId: projectId || '', dirtySinceSave: !projectId });
  }

  resume() {
    const draft = this.recoverable();
    if (!draft) return null;
    this.repository.saveEditorDraft(draft);
    return draft;
  }

  open(settings) {
    const incoming = this.repository.getEditorDraft();
    const autosave = this.repository.getEditorAutosave();
    // A stale navigation handoff cannot hide newer work after a crash.
    const state = autosave && autosave.dirtySinceSave ? autosave : incoming || autosave;
    if (state) {
      this.repository.saveEditorAutosave(state);
      if (incoming) this.repository.clearEditorDraft();
      return state;
    }
    const profile = getProfile(settings.defaultProfileId);
    const document = createDocument(Number(settings.stockWidthMm) || profile.defaultSize[0], Number(settings.stockHeightMm) || profile.defaultSize[1]);
    document.name = '未命名标签';
    document.elements = [];
    return { document, projectId: '', dirtySinceSave: false };
  }

  checkpoint(document, projectId, dirtySinceSave) {
    return this.repository.saveEditorAutosave({ document, projectId: projectId || '', dirtySinceSave: Boolean(dirtySinceSave) });
  }

  saveRecovery() {
    const draft = this.recoverable();
    if (!draft) return null;
    return this.repository.saveEditorProject(draft.document, draft.projectId);
  }

  discard() {
    // Clear the handoff first: if clearing autosave fails the work remains
    // recoverable. A successful discard can never resurrect a stale handoff.
    this.repository.clearEditorDraft();
    this.repository.clearEditorAutosave();
  }
}

module.exports = { EditorSession };
