import { id, createFile, normalizePath } from '../filesystem/fileSystem.js';

export const LIMITS = {
  maxFiles: 2000,
  maxDirectories: 2000,
  maxFileBytes: 1024 * 1024,
  maxProjectBytes: 10 * 1024 * 1024,
  maxPathDepth: 32,
  maxSegmentLength: 120,
};

const byteLength = value => new TextEncoder().encode(value).length;

export function createProject(name = 'Untitled project') {
  return { id: id(), name, createdAt: Date.now(), updatedAt: Date.now(), settings: {}, directories: [], files: [] };
}

export function clone(p) {
  return structuredClone(p);
}

export function touch(p) {
  p.updatedAt = Date.now();
  return p;
}

export function validateProject(p) {
  if (!p || typeof p !== 'object' || Array.isArray(p)) throw Error('Invalid project format.');
  if (typeof p.id !== 'string' || !p.id.trim() || ['__proto__', 'constructor', 'prototype'].includes(p.id)) throw Error('Invalid project id.');
  if (typeof p.name !== 'string' || !p.name.trim() || p.name.length > 120) throw Error('Invalid project name.');
  if (!Array.isArray(p.files) || !Array.isArray(p.directories)) throw Error('Invalid project format.');
  if (p.files.length > LIMITS.maxFiles || p.directories.length > LIMITS.maxDirectories) throw Error('Project exceeds the file or folder limit.');

  const paths = new Set();
  for (const directory of p.directories) {
    if (typeof directory !== 'string' || !directory || normalizePath(directory) !== directory || paths.has(directory)) throw Error('Invalid project directory.');
    const segments = directory.split('/');
    if (segments.length > LIMITS.maxPathDepth || segments.some(segment => segment.length > LIMITS.maxSegmentLength)) throw Error('Project path is too deep or long.');
    paths.add(directory);
  }
  let projectBytes = 0;
  for (const file of p.files) {
    if (!file || typeof file !== 'object' || typeof file.id !== 'string' || !file.id.trim() ||
        typeof file.path !== 'string' || !file.path || normalizePath(file.path) !== file.path ||
        typeof file.content !== 'string' || paths.has(file.path)) throw Error('Invalid project file.');
    const segments = file.path.split('/');
    if (segments.length > LIMITS.maxPathDepth || segments.some(segment => segment.length > LIMITS.maxSegmentLength)) throw Error('Project path is too deep or long.');
    const size = byteLength(file.content);
    if (size > LIMITS.maxFileBytes) throw Error('A file exceeds the size limit.');
    projectBytes += size;
    if (projectBytes > LIMITS.maxProjectBytes) throw Error('Project exceeds the size limit.');
    paths.add(file.path);
  }
  return p;
}

export function starter(name = 'Welcome') {
  const p = createProject(name);
  createFile(p, 'index.html', '<!doctype html>\n<html>\n  <head><link rel="stylesheet" href="style.css"></head>\n  <body><main><h1>Welcome to Forge</h1><p>Start building.</p></main><script src="script.js"></script></body>\n</html>');
  createFile(p, 'style.css', 'body { background: #111827; color: #e5e7eb; font: 16px system-ui; padding: 3rem; }\nmain { max-width: 42rem; margin: auto; }');
  createFile(p, 'script.js', "console.log('Forge is ready');");
  return p;
}
