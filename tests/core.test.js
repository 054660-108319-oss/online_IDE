import test from 'node:test'; import assert from 'node:assert/strict';
import {createProject} from '../src/project/project.js';
import {createFile,createDirectory,removeEntry,renameEntry} from '../src/filesystem/fileSystem.js';
import {fromTemplate} from '../src/templates/templates.js';
import {WebExecutionProvider} from '../src/execution/executionService.js';
import {mergeSettings} from '../src/settings/settings.js';
import {escapeAttribute,escapeHtml} from '../src/app/escaping.js';

test('creates nested directories and files',()=>{const p=createProject();createDirectory(p,'src/components');createFile(p,'src/components/App.js','export {}');assert.deepEqual(p.directories,['src','src/components']);assert.equal(p.files[0].path,'src/components/App.js')});
test('renames and moves directory descendants',()=>{const p=createProject();createFile(p,'src/a.js','x');renameEntry(p,'src','lib');assert.equal(p.files[0].path,'lib/a.js')});
test('deletes directory descendants',()=>{const p=createProject();createFile(p,'src/a.js','x');removeEntry(p,'src');assert.equal(p.files.length,0);assert.equal(p.directories.length,0)});
test('templates create portable projects',()=>{const p=fromTemplate('python','Demo');assert.equal(p.name,'Demo');assert.equal(p.files[0].path,'main.py')});
test('web execution inlines linked CSS and scripts as valid markup',async()=>{const p=fromTemplate('web','Web');p.files.find(file => file.path === 'index.html').content = '<link rel="stylesheet" href="style.css"><script src="script.js"></script>';const r=await new WebExecutionProvider().run(p,()=>{});assert.equal(r.exitCode,0);assert.match(r.html,/<style data-forge-source="style.css">/);assert.match(r.html,/<script data-forge-source="script.js">/);assert.doesNotMatch(r.html,/<link <style|<script><script/)});
test('settings retain defaults',()=>assert.equal(mergeSettings({fontSize:18}).fontSize,18));
test('escapes imported project metadata for HTML text and attributes',()=>{const malicious='</option><img src=x onerror="alert(1)">';assert.equal(escapeHtml(malicious),'&lt;/option&gt;&lt;img src=x onerror=&quot;alert(1)&quot;&gt;');assert.equal(escapeAttribute('x" onfocus="alert(1)'),'x&quot; onfocus=&quot;alert(1)')});
