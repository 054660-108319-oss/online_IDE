import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createProject, validateProject } from '../src/project/project.js';
import { createFile, createDirectory, normalizePath, removeEntry, renameEntry } from '../src/filesystem/fileSystem.js';
import { fromTemplate } from '../src/templates/templates.js';
import { WebExecutionProvider } from '../src/execution/executionService.js';
import { mergeSettings } from '../src/settings/settings.js';

test('creates nested directories and files', () => {
  const p = createProject();
  createDirectory(p, 'src/components');
  createFile(p, 'src/components/App.js', 'export {}');
  assert.deepEqual(p.directories, ['src', 'src/components']);
  assert.equal(p.files[0].path, 'src/components/App.js');
});

test('renames and moves directory descendants', () => {
  const p = createProject();
  createFile(p, 'src/a.js', 'x');
  renameEntry(p, 'src', 'lib');
  assert.equal(p.files[0].path, 'lib/a.js');
});

test('deletes directory descendants', () => {
  const p = createProject();
  createFile(p, 'src/a.js', 'x');
  removeEntry(p, 'src');
  assert.equal(p.files.length, 0);
  assert.equal(p.directories.length, 0);
});

test('templates create portable projects', () => {
  const p = fromTemplate('python', 'Demo');
  assert.equal(p.name, 'Demo');
  assert.equal(p.files[0].path, 'main.py');
});

test('web execution creates a preview document', async () => {
  const p = fromTemplate('web', 'Web');
  const r = await new WebExecutionProvider().run(p, () => {});
  assert.equal(r.exitCode, 0);
  assert.match(r.html, /Hello, Forge/);
  assert.match(r.html, /<script>/);
  assert.doesNotMatch(r.html, /<script\s+<script/);
});

test('preview bundle resolves query strings and escapes script terminators', async () => {
  const p = createProject();
  createFile(p, 'index.html', '<link rel="stylesheet" href="style.css?v=1"><script src="script.js#main"></script>');
  createFile(p, 'style.css', 'body{}');
  createFile(p, 'script.js', 'const marker = "</script>";');
  const r = await new WebExecutionProvider().run(p, () => {});
  assert.match(r.html, /<style>\s*body\{\}\s*<\/style>/);
  assert.match(r.html, /<script>\s*const marker/);
  assert.match(r.html, /<\\\/script>/);
});

test('rejects unsafe paths and file-folder collisions', () => {
  const p = createProject();
  createDirectory(p, 'src');
  assert.throws(() => createFile(p, 'src', 'collision'), /already exists/);
  for (const path of ['../escape.js', 'a/../../escape.js', '/absolute.js', 'a\\b.js']) {
    assert.throws(() => normalizePath(path), /Invalid project path/);
  }
});

test('validates imported project structure', () => {
  const p = createProject('Safe <name>');
  createFile(p, 'index.html', '<h1>safe</h1>');
  assert.doesNotThrow(() => validateProject(p));
  assert.throws(() => validateProject({ ...p, files: [{ ...p.files[0], path: '../evil.js' }] }));
  assert.throws(() => validateProject({ ...p, files: [{ ...p.files[0], content: 123 }] }));
  assert.throws(() => validateProject({ ...p, files: [{ ...p.files[0] }, { ...p.files[0] }] }));
});

test('settings retain defaults', () => assert.equal(mergeSettings({ fontSize: 18 }).fontSize, 18));

test('editor lifecycle guards remain enabled', async () => {
  const source = await readFile(new URL('../src/app/main.js', import.meta.url), 'utf8');
  assert.match(source, /shortcutsBound/);
  assert.match(source, /save\(\{rerender:false\}\)/);
  assert.match(source, /--tab-size/);
});
