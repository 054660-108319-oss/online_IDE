import { validateProject } from '../project/project.js';

const DB_NAME = 'forge-ide';
const DB_VERSION = 1;
const PROJECTS = 'projects';
const SETTINGS = 'settings';
const LEGACY_PROJECTS = 'forge-ide-projects-v1';
const LEGACY_SETTINGS = 'forge-ide-settings-v1';
let databasePromise;

function requestResult(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || Error('IndexedDB request failed.'));
  });
}

function openDatabase() {
  if (!globalThis.indexedDB) throw Error('IndexedDB is not available in this browser.');
  if (!databasePromise) {
    databasePromise = new Promise((resolve, reject) => {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = event => {
        const db = event.target.result;
        const projects = db.objectStoreNames.contains(PROJECTS) ? event.target.transaction.objectStore(PROJECTS) : db.createObjectStore(PROJECTS, { keyPath: 'id' });
        const settings = db.objectStoreNames.contains(SETTINGS) ? event.target.transaction.objectStore(SETTINGS) : db.createObjectStore(SETTINGS, { keyPath: 'id' });
        try {
          const legacyProjects = JSON.parse(localStorage.getItem(LEGACY_PROJECTS) || '{}');
          Object.values(legacyProjects).forEach(project => {
            try { projects.put(validateProject(project)); } catch { /* Ignore corrupt legacy records. */ }
          });
          const legacySettings = JSON.parse(localStorage.getItem(LEGACY_SETTINGS) || '{}');
          if (legacySettings && typeof legacySettings === 'object' && !Array.isArray(legacySettings)) settings.put({ id: 'current', ...legacySettings });
        } catch {
          // A corrupt legacy value must not prevent the database from opening.
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error || Error('Unable to open IndexedDB.'));
    });
  }
  return databasePromise;
}

async function withStore(storeName, mode, operation) {
  const db = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = db.transaction(storeName, mode);
    const store = transaction.objectStore(storeName);
    let result;
    transaction.oncomplete = () => resolve(result);
    transaction.onerror = () => reject(transaction.error || Error('IndexedDB transaction failed.'));
    Promise.resolve(operation(store)).then(value => { result = value; }).catch(reject);
  });
}

export class ProjectRepository {
  async list() {
    const records = await withStore(PROJECTS, 'readonly', store => requestResult(store.getAll()));
    return records.filter(project => {
      try { validateProject(project); return true; } catch { return false; }
    }).sort((a, b) => (b.updatedAt || 0) - (a.updatedAt || 0));
  }

  async save(project) {
    validateProject(project);
    await withStore(PROJECTS, 'readwrite', store => requestResult(store.put(project)));
    return project;
  }

  async get(id) {
    const project = await withStore(PROJECTS, 'readonly', store => requestResult(store.get(id)));
    try { return project ? validateProject(project) : null; } catch { return null; }
  }

  async delete(id) {
    await withStore(PROJECTS, 'readwrite', store => requestResult(store.delete(id)));
  }

  async settings() {
    const record = await withStore(SETTINGS, 'readonly', store => requestResult(store.get('current')));
    if (!record) return {};
    const { id, ...settings } = record;
    return settings;
  }

  async saveSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) throw Error('Invalid settings.');
    await withStore(SETTINGS, 'readwrite', store => requestResult(store.put({ id: 'current', ...settings })));
    return settings;
  }
}
