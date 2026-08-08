const KEYS = {
  projects: 'niim-label:projects',
  templates: 'niim-label:templates',
  settings: 'niim-label:settings',
  dataRows: 'niim-label:data-rows'
};

function read(key, fallback) {
  try {
    const value = localStorage.getItem(key);
    return value ? JSON.parse(value) : fallback;
  } catch (error) {
    return fallback;
  }
}

function write(key, value) {
  localStorage.setItem(key, JSON.stringify(value));
  return value;
}

function remove(key) {
  localStorage.removeItem(key);
}

module.exports = { KEYS, read, remove, write };
