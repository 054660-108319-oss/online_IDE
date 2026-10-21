import { ProjectRepository } from '../persistence/repository.js';
import { createProject, touch } from '../project/project.js';
import { createFile, createDirectory, removeEntry, renameEntry, parentPath } from '../filesystem/fileSystem.js';
import { fromTemplate } from '../templates/templates.js';
import { ExecutionService } from '../execution/executionService.js';
import { exportProject, importProject } from '../project/archive.js';
import { mergeSettings } from '../settings/settings.js';
import { commands } from '../commands/commands.js';

const $ = selector => document.querySelector(selector);
const repo = new ProjectRepository();
const execute = new ExecutionService();
let projects = [];
let project;
let active;
let dirty = false;
let settings;
let terminalOpen = true;
let explorerOpen = true;
let previewHtml = '';
let autoSaveTimer = null;
let shortcutsBound = false;
let runId = 0;

const toast = (message, type = 'info') => {
  const el = $('#toast');
  el.textContent = message;
  el.className = `toast ${type}`;
  setTimeout(() => { el.className = 'toast'; }, 3500);
};

async function boot() {
  settings = mergeSettings(await repo.settings());
  projects = await repo.list();
  if (!projects.length) {
    project = fromTemplate('web', 'My first project');
    await repo.save(project);
    projects = [project];
  } else {
    project = projects[0];
  }
  active = project.files[0]?.path;
  mount();
  render();
}

function mount() {
  if ($('#app').dataset.mounted) return;
  $('#app').innerHTML = `<header>
    <div class="brand">◈ <b>Forge</b><span>IDE</span></div>
    <select id="projectSelect" aria-label="Select project"></select>
    <button id="newProject">＋ Project</button>
    <div class="head-actions">
      <button id="save">Save</button><button class="run" id="run">▶ Run</button>
      <button id="terminalToggle">Terminal</button><button id="palette">⌘ P</button><button id="settings">⚙</button>
    </div>
  </header>
  <main id="mainLayout">
    <aside class="explorer"><div class="panel-title">EXPLORER <span><button id="newFile" title="New file">＋</button><button id="newFolder" title="New folder">□</button><button id="import" title="Import project">⇧</button></span></div><div class="root" id="projectRoot"></div><nav id="tree"></nav><div class="explorer-footer"><button id="export">⇩ Export</button><button id="deleteProject">Delete project</button></div></aside>
    <section class="work"><div class="tabs" id="tabs"></div><div class="editor-wrap" id="editorWrap"></div></section>
    <aside class="preview"><div class="panel-title">PREVIEW <span><button id="refresh">↻</button><button id="openPreview">↗</button></span></div><div class="device"><iframe id="previewFrame" sandbox="allow-scripts" title="Project preview"></iframe></div><div class="preview-note">Web preview runs in an isolated iframe.</div></aside>
  </main>
  <section class="terminal" id="terminal"><div class="terminal-head"><span>TERMINAL</span><span><button id="clearTerminal">Clear</button><button id="toggleTerminal">×</button></span></div><pre id="output">Ready. Create or open an HTML project, then press Run.</pre></section>
  <footer><span id="saveState"></span><span id="activeFile"></span><span id="editorSettings"></span></footer>
  <div id="modal"></div><div id="toast" class="toast"></div><input id="fileInput" type="file" accept=".json,.forge-project.json" hidden>`;
  $('#app').dataset.mounted = 'true';
  bind();
}

function buildTree() {
  const children = new Map([['', []]]);
  const add = (path, type, file = null) => {
    const parent = parentPath(path);
    if (!children.has(parent)) children.set(parent, []);
    children.get(parent).push({ path, type, file });
    if (type === 'directory' && !children.has(path)) children.set(path, []);
  };
  project.directories.forEach(path => add(path, 'directory'));
  project.files.forEach(file => {
    let parent = parentPath(file.path);
    while (parent) {
      if (!children.has(parent)) add(parent, 'directory');
      parent = parentPath(parent);
    }
    add(file.path, 'file', file);
  });
  children.forEach(items => items.sort((a, b) => a.type.localeCompare(b.type) || a.path.localeCompare(b.path)));
  const renderChildren = (base, depth = 0) => (children.get(base) || []).map(item => {
    const label = escape(item.path.split('/').pop());
    if (item.type === 'directory') return `<div class="tree-dir"><div class="tree-row folder" data-path="${escape(item.path)}" style="padding-left:${14 + depth * 18}px">⌄ <span>📁 ${label}</span><button data-action="manage" data-path="${escape(item.path)}">⋯</button></div>${renderChildren(item.path, depth + 1)}</div>`;
    return `<div class="tree-row file ${active === item.path ? 'selected' : ''}" data-open="${escape(item.path)}" style="padding-left:${14 + depth * 18}px"><span>${icon(item.path)} ${label}</span><button data-action="manage" data-path="${escape(item.path)}">⋯</button></div>`;
  }).join('');
  return renderChildren('');
}

function icon(path) {
  return path.endsWith('.html') ? '◇' : path.endsWith('.css') ? '#' : path.endsWith('.js') ? 'JS' : path.endsWith('.json') ? '{}' : '•';
}

function render() {
  document.documentElement.style.setProperty('--font-size', `${settings.fontSize}px`);
  document.documentElement.style.setProperty('--tab-size', settings.tabSize);
  $('#mainLayout').classList.toggle('no-explorer', !explorerOpen);
  $('#terminal').classList.toggle('hidden', !terminalOpen);
  document.body.classList.toggle('terminal-closed', !terminalOpen);
  $('#projectRoot').textContent = project.name;
  $('#projectSelect').innerHTML = projects.map(p => `<option value="${escape(p.id)}" ${p.id === project.id ? 'selected' : ''}>${escape(p.name)}</option>`).join('');
  $('#tree').innerHTML = buildTree();
  renderWork();
  $('#saveState').textContent = `◉ ${dirty ? 'Unsaved changes' : 'Saved'}`;
  $('#activeFile').textContent = `${active || 'No file'} · UTF-8`;
  $('#editorSettings').textContent = `Spaces: ${settings.tabSize} · ${settings.wordWrap ? 'Wrap' : 'No wrap'}`;
  updatePreview();
}

function renderWork() {
  $('#tabs').innerHTML = active ? `<div class="tab active">${escape(active.split('/').pop())}${dirty ? ' ●' : ''}<button id="closeTab">×</button></div>` : '<div class="tab">No file open</div>';
  const currentEditor = $('#editor');
  if (!active) {
    $('#editorWrap').innerHTML = '<div class="empty">Select a file to start editing</div>';
    return;
  }
  if (currentEditor?.dataset.path === active && currentEditor.dataset.projectId === project.id) return;
  const file = project.files.find(item => item.path === active);
  $('#editorWrap').innerHTML = `<div class="gutter"></div><textarea id="editor" data-path="${escape(active)}" data-project-id="${escape(project.id)}" spellcheck="false" aria-label="Code editor">${escape(file?.content || '')}</textarea>`;
  $('#editor').focus();
}

const escape = value => String(value).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function bind() {
  if (!shortcutsBound) {
    document.addEventListener('keydown', keys);
    shortcutsBound = true;
  }
  $('#tree').onclick = event => {
    const manageButton = event.target.closest('[data-action="manage"]');
    if (manageButton) { manage(manageButton.dataset.path); return; }
    const path = event.target.closest('[data-open]')?.dataset.open;
    if (path) { active = path; dirty = false; render(); return; }
  };
  $('#editorWrap').oninput = event => {
    if (event.target.id !== 'editor') return;
    const file = project.files.find(item => item.path === active);
    if (!file) return;
    file.content = event.target.value;
    dirty = true;
    renderStatus();
    if (settings.autoSave) scheduleAutoSave(project);
  };
  $('#tabs').onclick = () => { if (active) { active = null; renderWork(); renderStatus(); } };
  $('#save').onclick = () => save(project);
  $('#run').onclick = run;
  $('#terminalToggle').onclick = () => { terminalOpen = !terminalOpen; render(); };
  $('#newFile').onclick = () => add(false);
  $('#newFolder').onclick = () => add(true);
  $('#newProject').onclick = newProject;
  $('#projectSelect').onchange = async event => { cancelAutoSave(); project = await repo.get(event.target.value); active = project?.files[0]?.path; dirty = false; render(); };
  $('#deleteProject').onclick = deleteProject;
  $('#export').onclick = () => exportProject(project);
  $('#import').onclick = () => $('#fileInput').click();
  $('#fileInput').onchange = async event => {
    try {
      cancelAutoSave();
      project = await importProject(event.target.files[0]);
      await save(project);
      projects = await repo.list();
      active = project.files[0]?.path;
      render();
      toast('Project imported.', 'success');
    } catch (error) { toast(error.message, 'error'); }
    finally { event.target.value = ''; }
  };
  $('#clearTerminal').onclick = () => { $('#output').textContent = ''; };
  $('#toggleTerminal').onclick = () => { terminalOpen = false; render(); };
  $('#refresh').onclick = run;
  $('#openPreview').onclick = () => { const windowRef = window.open(); if (windowRef) windowRef.document.write(previewHtml || '<p>Run a web project first.</p>'); else toast('Popup was blocked by the browser.', 'error'); };
  $('#palette').onclick = palette;
  $('#settings').onclick = settingsModal;
}

function renderStatus() {
  $('#saveState').textContent = `◉ ${dirty ? 'Unsaved changes' : 'Saved'}`;
  $('#activeFile').textContent = `${active || 'No file'} · UTF-8`;
  $('#tabs').innerHTML = active ? `<div class="tab active">${escape(active.split('/').pop())}${dirty ? ' ●' : ''}<button id="closeTab">×</button></div>` : '<div class="tab">No file open</div>';
}

function cancelAutoSave() {
  clearTimeout(autoSaveTimer);
  autoSaveTimer = null;
}

function scheduleAutoSave(targetProject) {
  cancelAutoSave();
  const targetId = targetProject.id;
  autoSaveTimer = setTimeout(() => {
    autoSaveTimer = null;
    save(targetProject, { rerender: project.id === targetId });
  }, 500);
}

async function save(targetProject = project, { rerender = true } = {}) {
  try {
    touch(targetProject);
    await repo.save(targetProject);
    projects = await repo.list();
    if (project.id === targetProject.id) {
      dirty = false;
      if (rerender) render(); else renderStatus();
    }
    toast('Project saved.', 'success');
  } catch (error) { toast(error.message, 'error'); }
}

function add(folder) {
  const path = prompt(folder ? 'Folder path (example: src/components)' : 'File path (example: src/main.js)');
  if (!path) return;
  try { folder ? createDirectory(project, path) : createFile(project, path, ''); active = folder ? active : path; dirty = true; save(project); }
  catch (error) { toast(error.message, 'error'); }
}

function manage(path) {
  const choice = prompt('Type r to rename/move or d to delete:', 'r');
  if (choice?.toLowerCase() === 'd' && confirm(`Delete ${path}?`)) {
    try { removeEntry(project, path); if (active === path) active = null; dirty = true; save(project); }
    catch (error) { toast(error.message, 'error'); }
  } else if (choice?.toLowerCase() === 'r') rename(path);
}

function rename(path) {
  const destination = prompt('Rename or move to:', path);
  if (!destination || destination === path) return;
  try { renameEntry(project, path, destination); if (active === path) active = destination; dirty = true; save(project); }
  catch (error) { toast(error.message, 'error'); }
}

async function deleteProject() {
  if (!confirm(`Delete ${project.name}?`)) return;
  cancelAutoSave();
  await repo.delete(project.id);
  projects = await repo.list();
  if (!projects.length) { project = createProject('Untitled project'); createFile(project, 'index.html', '<h1>New project</h1>'); await repo.save(project); projects = [project]; }
  project = projects[0]; active = project.files[0]?.path; dirty = false; render();
}

async function newProject() {
  const name = prompt('Project name', 'New project');
  if (!name) return;
  const kind = prompt('Template: web, typescript, react, python, kotlin', 'web');
  cancelAutoSave();
  project = fromTemplate(kind, name);
  await save(project);
  projects = await repo.list(); active = project.files[0]?.path; render();
}

async function run() {
  const currentRun = ++runId;
  terminalOpen = true;
  render();
  const output = $('#output');
  output.textContent = 'Running…\n';
  try {
    const result = await execute.run(project, (kind, message) => { if (currentRun === runId) output.textContent += `[${kind}] ${message}\n`; });
    if (currentRun !== runId) return;
    previewHtml = result.html || previewHtml;
    output.textContent += `\nProcess finished with exit code ${result.exitCode} in ${Math.round(result.duration)}ms`;
    updatePreview();
    toast('Run completed.', 'success');
  } catch (error) { if (currentRun === runId) { output.textContent += `\n[stderr] ${error.message}\nProcess failed.`; toast(error.message, 'error'); } }
}

function updatePreview() {
  const frame = $('#previewFrame');
  if (frame && previewHtml) frame.srcdoc = previewHtml;
}

function palette() {
  const actions = { newFile: () => add(false), newFolder: () => add(true), save: () => save(project), run, toggleTerminal: () => { terminalOpen = !terminalOpen; render(); }, toggleExplorer: () => { explorerOpen = !explorerOpen; render(); }, export: () => exportProject(project), import: () => $('#fileInput').click(), preview: () => $('#openPreview').click() };
  const list = commands(actions);
  modal(`<h2>Command Palette</h2><input id="commandSearch" autofocus placeholder="Type a command…"><div id="commandList">${list.map(command => `<button data-command="${command.id}">${command.label}<kbd>${command.shortcut || ''}</kbd></button>`).join('')}</div>`);
  $('#commandList').onclick = event => { const command = list.find(item => item.id === event.target.closest('button')?.dataset.command); if (command) { closeModal(); command.run(); } };
  $('#commandSearch').oninput = event => document.querySelectorAll('#commandList button').forEach(button => { button.hidden = !button.textContent.toLowerCase().includes(event.target.value.toLowerCase()); });
}

function settingsModal() {
  modal(`<h2>IDE Settings</h2><label>Font size <input id="font" type="range" min="12" max="20" value="${settings.fontSize}"></label><label>Tab size <select id="tabsize"><option>2</option><option>4</option></select></label><label><input id="wrap" type="checkbox" ${settings.wordWrap ? 'checked' : ''}> Word wrap</label><label><input id="autosave" type="checkbox" ${settings.autoSave ? 'checked' : ''}> Auto-save</label><button id="settingsSave" class="run">Save settings</button>`);
  $('#tabsize').value = settings.tabSize;
  $('#settingsSave').onclick = async () => { settings = { ...settings, fontSize: +$('#font').value, tabSize: +$('#tabsize').value, wordWrap: $('#wrap').checked, autoSave: $('#autosave').checked }; await repo.saveSettings(settings); closeModal(); render(); };
}

function modal(content) {
  $('#modal').innerHTML = `<div class="backdrop"></div><div class="dialog">${content}<button class="close">×</button></div>`;
  $('.backdrop').onclick = closeModal;
  $('.close').onclick = closeModal;
}
function closeModal() { $('#modal').innerHTML = ''; }
function keys(event) {
  if (!(event.ctrlKey || event.metaKey)) return;
  const key = event.key.toLowerCase();
  if (key === 's') { event.preventDefault(); save(project); }
  if (key === 'p') { event.preventDefault(); palette(); }
  if (key === 'b') { event.preventDefault(); explorerOpen = !explorerOpen; render(); }
  if (event.key === 'Enter') { event.preventDefault(); run(); }
  if (key === 'w') { event.preventDefault(); active = null; render(); }
}

boot().catch(error => { document.body.textContent = `Forge failed to start: ${error.message}`; });
