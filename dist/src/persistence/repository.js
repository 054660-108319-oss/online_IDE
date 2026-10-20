import { validateProject } from '../project/project.js';

const KEY = 'forge-ide-projects-v1';
const SETTINGS = 'forge-ide-settings-v1';

export class ProjectRepository {
  async list() {
    return Object.values(this.all()).sort((a, b) => b.updatedAt - a.updatedAt);
  }

  all() {
    try {
      const value = JSON.parse(localStorage.getItem(KEY) || '{}');
      if (!value || typeof value !== 'object' || Array.isArray(value)) throw Error('Invalid project storage.');
      return value;
    } catch {
      throw Error('Unable to read browser storage.');
    }
  }

  async save(project) {
    validateProject(project);
    const all = this.all();
    all[project.id] = project;
    localStorage.setItem(KEY, JSON.stringify(all));
    return project;
  }

  async get(id) {
    return this.all()[id] || null;
  }

  async delete(id) {
    const all = this.all();
    delete all[id];
    localStorage.setItem(KEY, JSON.stringify(all));
  }

  async settings() {
    try {
      const value = JSON.parse(localStorage.getItem(SETTINGS) || '{}');
      return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
    } catch {
      return {};
    }
  }

  async saveSettings(settings) {
    if (!settings || typeof settings !== 'object' || Array.isArray(settings)) {
      throw Error('Invalid settings.');
    }
    localStorage.setItem(SETTINGS, JSON.stringify(settings));
    return settings;
  }
}
