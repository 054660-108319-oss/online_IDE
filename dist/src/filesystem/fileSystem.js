export const id = () => crypto.randomUUID();

export function normalizePath(path) {
  if (typeof path !== 'string') throw Error('Invalid project path.');
  const value = path.trim();
  if (!value) return '';
  if (value.startsWith('/') || value.includes('\\')) throw Error('Invalid project path.');
  const parts = value.split('/').filter(Boolean);
  if (!parts.length || parts.some(part => part === '.' || part === '..' || /[\0-\x1f]/.test(part))) {
    throw Error('Invalid project path.');
  }
  return parts.join('/');
}

export function parentPath(path) {
  const p = normalizePath(path);
  return p.includes('/') ? p.slice(0, p.lastIndexOf('/')) : '';
}

export function basename(path) {
  return normalizePath(path).split('/').pop();
}

function assertFreePath(project, path) {
  if (project.files.some(file => file.path === path) || project.directories.includes(path)) {
    throw Error('A file or folder already exists at that path.');
  }
}

export function createFile(project, path, content = '') {
  path = normalizePath(path);
  if (!path) throw Error('A file path is required.');
  if (typeof content !== 'string') throw Error('File content must be a string.');
  assertFreePath(project, path);
  ensureDirs(project, parentPath(path));
  project.files.push({ id: id(), path, content, updatedAt: Date.now() });
  return project;
}

export function createDirectory(project, path) {
  path = normalizePath(path);
  if (!path) throw Error('A folder path is required.');
  assertFreePath(project, path);
  ensureDirs(project, parentPath(path));
  project.directories.push(path);
  return project;
}

export function ensureDirs(project, path) {
  let at = '';
  for (const part of normalizePath(path).split('/').filter(Boolean)) {
    at = at ? `${at}/${part}` : part;
    if (project.files.some(file => file.path === at)) {
      throw Error(`Cannot create a folder inside file "${at}".`);
    }
    if (!project.directories.includes(at)) project.directories.push(at);
  }
}

export function removeEntry(project, path) {
  path = normalizePath(path);
  const file = project.files.find(f => f.path === path);
  if (file) {
    project.files = project.files.filter(f => f !== file);
    return project;
  }
  const exists = project.directories.includes(path);
  if (!exists) throw Error('Item was not found.');
  project.directories = project.directories.filter(d => d !== path && !d.startsWith(`${path}/`));
  project.files = project.files.filter(f => !f.path.startsWith(`${path}/`));
  return project;
}

export function renameEntry(project, oldPath, newPath) {
  oldPath = normalizePath(oldPath);
  newPath = normalizePath(newPath);
  if (!newPath) throw Error('A destination path is required.');
  if (newPath === oldPath || newPath.startsWith(`${oldPath}/`)) {
    throw Error('An item cannot be moved inside itself.');
  }
  assertFreePath(project, newPath);

  const file = project.files.find(f => f.path === oldPath);
  if (file) {
    ensureDirs(project, parentPath(newPath));
    file.path = newPath;
    file.updatedAt = Date.now();
    return project;
  }
  if (!project.directories.includes(oldPath)) throw Error('Item was not found.');
  ensureDirs(project, parentPath(newPath));
  project.directories = project.directories.map(d => d === oldPath
    ? newPath
    : d.startsWith(`${oldPath}/`) ? newPath + d.slice(oldPath.length) : d);
  project.files.forEach(file => {
    if (file.path.startsWith(`${oldPath}/`)) file.path = newPath + file.path.slice(oldPath.length);
  });
  return project;
}
