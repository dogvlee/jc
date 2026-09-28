// WeChat storage has atomic writes per key, but no transaction across keys.
// Persist an undo journal before changing a collection of keys, so a killed
// process or a failed rollback can recover before any later repository access.
function storageError(code, message, cause, key) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  if (key) error.key = key;
  return error;
}

function absent(value) {
  return value === '' || value === undefined || value === null;
}

class RecoverableStorage {
  constructor(api, journalKey, allowedKeys) {
    this.api = api;
    this.journalKey = journalKey;
    this.allowedKeys = new Set(allowedKeys);
  }

  rawRead(key) {
    try {
      return this.api.getStorageSync(key);
    } catch (error) {
      throw storageError('STORAGE_READ_FAILED', '本地数据读取失败，为避免覆盖原数据，本次操作已停止', error, key);
    }
  }

  rawWrite(key, value) {
    try {
      this.api.setStorageSync(key, value);
      return value;
    } catch (error) {
      throw storageError('STORAGE_WRITE_FAILED', '本地存储写入失败，请检查存储空间并重试', error, key);
    }
  }

  rawRemove(key) {
    try {
      this.api.removeStorageSync(key);
    } catch (error) {
      throw storageError('STORAGE_REMOVE_FAILED', '本地数据清除失败，请重试', error, key);
    }
  }

  rollback(entries) {
    let failure = null;
    entries.forEach((entry) => {
      try {
        if (entry.existed) this.rawWrite(entry.key, entry.value);
        else this.rawRemove(entry.key);
      } catch (error) {
        failure = failure || error;
      }
    });
    if (failure) throw failure;
  }

  recover() {
    const journal = this.rawRead(this.journalKey);
    if (absent(journal)) return;
    if (!journal || journal.version !== 1
      || !['pending', 'committed'].includes(journal.status)
      || !Array.isArray(journal.entries) || !journal.entries.length
      || journal.entries.some((entry) => !entry || !this.allowedKeys.has(entry.key)
        || typeof entry.existed !== 'boolean'
        || (entry.existed && !Object.prototype.hasOwnProperty.call(entry, 'value')))) {
      throw storageError('STORAGE_RECOVERY_INVALID', '本地恢复记录损坏，已停止写入以保护原数据');
    }
    try {
      if (journal.status === 'pending') this.rollback(journal.entries);
      this.rawRemove(this.journalKey);
    } catch (error) {
      throw storageError('STORAGE_RECOVERY_FAILED', '上次存储操作尚未恢复，请释放存储空间后重试，原始数据恢复记录仍已保留', error);
    }
  }

  read(key, fallback) {
    this.recover();
    const value = this.rawRead(key);
    return absent(value) ? fallback : value;
  }

  write(key, value) {
    this.recover();
    return this.rawWrite(key, value);
  }

  remove(key) {
    this.recover();
    this.rawRemove(key);
  }

  transact(changes) {
    this.recover();
    const entries = changes.map(([key]) => {
      if (!this.allowedKeys.has(key)) throw new Error('不支持的存储事务键');
      const value = this.rawRead(key);
      return absent(value) ? { key, existed: false } : {
        key, existed: true, value: JSON.parse(JSON.stringify(value))
      };
    });
    const journal = { version: 1, status: 'pending', entries };
    // If the journal cannot fit, leave all original keys untouched.
    this.rawWrite(this.journalKey, journal);
    try {
      changes.forEach(([key, value]) => this.rawWrite(key, value));
      this.rawWrite(this.journalKey, { ...journal, status: 'committed' });
    } catch (error) {
      try {
        this.rollback(entries);
      } catch (rollbackError) {
        throw storageError('RESTORE_ROLLBACK_FAILED', '恢复中断，已保留原始数据恢复记录；请释放存储空间后重新打开小程序', error);
      }
      // A pending journal is safe to replay if cleanup itself fails.
      try { this.rawRemove(this.journalKey); } catch (cleanupError) { /* retry on next access */ }
      throw storageError('RESTORE_FAILED', '恢复未完成，原有本地数据已保留', error);
    }
    // A committed journal must only be cleaned up, never rolled back.
    try { this.rawRemove(this.journalKey); } catch (cleanupError) { /* retry on next access */ }
  }
}

module.exports = { RecoverableStorage, storageError };
