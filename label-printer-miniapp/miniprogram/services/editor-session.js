const { createDocument } = require('../core/document');
const { getProfile } = require('../core/profiles');

// A navigation draft is only a handoff. The autosave is the durable session;
// never replace dirty work merely because another page opens the editor.
//
// Every session state ({ document, projectId, dirtySinceSave, batch }) carries
// `batch`: null for a single label, or { rows, source } while the editor
// prints data rows (see repository normalizeBatch).
class EditorSession {
  constructor(repository) {
    this.repository = repository;
    // Batch of the state this instance last opened or wrote; undefined until
    // then, so a fresh instance falls back to the stored autosave.
    this.batch = undefined;
  }

  remember(state) {
    this.batch = state && state.batch ? state.batch : null;
    return state;
  }

  recoverable() {
    const draft = this.repository.getEditorAutosave();
    return draft && draft.dirtySinceSave ? draft : null;
  }

  /**
   * Hands `document` to the editor page. `options.batch` ({ rows, source:
   * 'data' }) opens it in batch mode; without it the label opens as before.
   */
  stage(document, projectId, options) {
    if (this.recoverable()) {
      const error = new Error('请先继续编辑或保存上次草稿，再打开其他标签');
      error.code = 'EDITOR_DRAFT_PENDING';
      throw error;
    }
    // A label just opened is no change yet: an untouched template copy
    // closes without asking and leaves no draft behind. The first edit marks
    // it unsaved.
    return this.remember(this.repository.saveEditorDraft({
      document,
      projectId: projectId || '',
      dirtySinceSave: false,
      batch: options && options.batch ? options.batch : null
    }));
  }

  resume() {
    const draft = this.recoverable();
    if (!draft) return null;
    this.repository.saveEditorDraft(draft);
    return this.remember(draft);
  }

  open(settings) {
    const incoming = this.repository.getEditorDraft();
    const autosave = this.repository.getEditorAutosave();
    // A stale navigation handoff cannot hide newer work after a crash.
    const state = autosave && autosave.dirtySinceSave ? autosave : incoming || autosave;
    if (state) {
      this.repository.saveEditorAutosave(state);
      if (incoming) this.repository.clearEditorDraft();
      return this.remember(state);
    }
    const profile = getProfile(settings.defaultProfileId);
    const document = createDocument(Number(settings.stockWidthMm) || profile.defaultSize[0], Number(settings.stockHeightMm) || profile.defaultSize[1]);
    document.name = '未命名标签';
    document.elements = [];
    return this.remember({ document, projectId: '', dirtySinceSave: false, batch: null });
  }

  /**
   * Autosaves the editor state. Omitting `batch` keeps the current batch, so
   * existing callers stay in batch mode; pass null to leave it.
   */
  checkpoint(document, projectId, dirtySinceSave, batch) {
    // An explicit batch is the new intent even if this write fails, so a
    // retry cannot quietly bring back the previous rows.
    if (batch !== undefined) this.batch = batch;
    return this.remember(this.repository.saveEditorAutosave({
      document,
      projectId: projectId || '',
      dirtySinceSave: Boolean(dirtySinceSave),
      batch: this.currentBatch()
    }));
  }

  currentBatch() {
    if (this.batch !== undefined) return this.batch;
    // Losing batch mode is recoverable from the data page; losing the draft
    // is not, so a failed lookup must never block the autosave itself.
    try {
      return this.repository.getEditorAutosaveBatch();
    } catch (error) {
      return null;
    }
  }

  /** Leaves batch mode; the label and its unsaved changes stay as they are. */
  clearBatch() {
    this.batch = null;
    const autosave = this.repository.getEditorAutosave();
    if (!autosave || !autosave.batch) return autosave;
    return this.repository.saveEditorAutosave(Object.assign({}, autosave, { batch: null }));
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
    this.batch = null;
  }
}

module.exports = { EditorSession };
