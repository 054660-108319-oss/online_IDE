import test from 'node:test';
import assert from 'node:assert/strict';
import {createProject} from '../src/project/project.js';
import {createFile,createDirectory,removeEntry,renameEntry} from '../src/filesystem/fileSystem.js';
import {fromTemplate} from '../src/templates/templates.js';
import {WebExecutionProvider} from '../src/execution/executionService.js';
import {mergeSettings} from '../src/settings/settings.js';
import {SaveLifecycle} from '../src/app/saveLifecycle.js';
import {editorCssVariables} from '../src/app/editorSettings.js';
import {installKeyboardListener} from '../src/app/keyboardLifecycle.js';

test('creates nested directories and files',()=>{const p=createProject();createDirectory(p,'src/components');createFile(p,'src/components/App.js','export {}');assert.deepEqual(p.directories,['src','src/components']);assert.equal(p.files[0].path,'src/components/App.js')});
test('renames and moves directory descendants',()=>{const p=createProject();createFile(p,'src/a.js','x');renameEntry(p,'src','lib');assert.equal(p.files[0].path,'lib/a.js')});
test('deletes directory descendants',()=>{const p=createProject();createFile(p,'src/a.js','x');removeEntry(p,'src');assert.equal(p.files.length,0);assert.equal(p.directories.length,0)});
test('templates create portable projects',()=>{const p=fromTemplate('python','Demo');assert.equal(p.name,'Demo');assert.equal(p.files[0].path,'main.py')});
test('web execution inlines linked CSS and scripts as valid markup',async()=>{const p=fromTemplate('web','Web');p.files.find(file => file.path === 'index.html').content = '<link rel="stylesheet" href="style.css"><script src="script.js"></script>';const r=await new WebExecutionProvider().run(p,()=>{});assert.equal(r.exitCode,0);assert.match(r.html,/<style data-forge-source="style.css">/);assert.match(r.html,/<script data-forge-source="script.js">/);assert.doesNotMatch(r.html,/<link <style|<script><script/)});
test('settings retain defaults',()=>assert.equal(mergeSettings({fontSize:18}).fontSize,18));

test('auto-save queues snapshots, skips project listing, and only marks the latest revision saved', async () => {
  const project = createProject('Editor lifecycle'); createFile(project, 'index.html', 'A');
  let releaseFirst; const firstSave = new Promise(resolve => { releaseFirst = resolve; });
  const snapshots = []; const saved = []; let listCalls = 0;
  const lifecycle = new SaveLifecycle({repository:{async save(snapshot){snapshots.push(snapshot);if(snapshots.length===1)await firstSave;},async list(){listCalls++;return [project];}},getProject:()=>project,onProjects:()=>{},onSaved:()=>saved.push(project.files[0].content),onError:()=>{}});
  const saveA = lifecycle.save({refreshProjects:false});
  project.files[0].content = 'B';
  const saveB = lifecycle.save({refreshProjects:false});
  releaseFirst();
  const [resultA,resultB] = await Promise.all([saveA,saveB]);
  assert.deepEqual(snapshots.map(snapshot=>snapshot.files[0].content), ['A','B']);
  assert.equal(resultA.current,false); assert.equal(resultB.current,true);
  assert.deepEqual(saved,['B']); assert.equal(listCalls,0);
});

test('save failure keeps the latest revision unsaved and reports the error', async () => {
  const project = createProject(); const failures = []; let saved = false;
  const lifecycle = new SaveLifecycle({repository:{async save(){throw Error('storage unavailable');},async list(){throw Error('not reached');}},getProject:()=>project,onProjects:()=>{},onSaved:()=>{saved=true;},onError:error=>failures.push(error.message)});
  const result = await lifecycle.save({refreshProjects:false});
  assert.equal(result.current,false); assert.equal(saved,false); assert.deepEqual(failures,['storage unavailable']);
});

test('keyboard listener installation is idempotent across render lifecycles', () => {
  let added = 0; let removed = 0; const documentRef = {addEventListener(){added++;},removeEventListener(){removed++;}}; const listener = ()=>{};
  const firstCleanup = installKeyboardListener(documentRef, listener);
  const secondCleanup = installKeyboardListener(documentRef, listener);
  assert.equal(added,1); assert.equal(firstCleanup,secondCleanup);
  firstCleanup(); assert.equal(removed,1);
});

test('editor settings expose tab size and word wrap as editor CSS values', () => {
  assert.deepEqual(editorCssVariables(mergeSettings({tabSize:4,wordWrap:true})), {'--font-size':'14px','--tab-size':'4','--editor-white-space':'pre-wrap'});
  assert.equal(editorCssVariables(mergeSettings({wordWrap:false}))['--editor-white-space'], 'pre');
});
