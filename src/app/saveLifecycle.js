import {touch} from '../project/project.js';

/** Serializes saves and only reports success for the newest requested revision. */
export class SaveLifecycle {
  constructor({repository, getProject, onProjects, onSaved, onError}) {
    this.repository = repository;
    this.getProject = getProject;
    this.onProjects = onProjects;
    this.onSaved = onSaved;
    this.onError = onError;
    this.latestRevision = 0;
    this.queue = Promise.resolve();
  }

  save({refreshProjects = false} = {}) {
    const revision = ++this.latestRevision;
    const project = this.getProject();
    touch(project);
    const snapshot = structuredClone(project);
    const work = async () => {
      try {
        await this.repository.save(snapshot);
        const projects = refreshProjects ? await this.repository.list() : null;
        if (revision !== this.latestRevision) return {revision, current: false};
        if (projects) this.onProjects(projects);
        this.onSaved();
        return {revision, current: true};
      } catch (error) {
        if (revision === this.latestRevision) this.onError(error);
        return {revision, current: false, error};
      }
    };
    this.queue = this.queue.then(work, work);
    return this.queue;
  }
}
