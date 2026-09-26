import {id,createFile} from '../filesystem/fileSystem.js';
export function createProject(name='Untitled project'){return {id:id(),name,createdAt:Date.now(),updatedAt:Date.now(),settings:{},directories:[],files:[]}}
export function clone(p){return structuredClone(p)}
export function touch(p){p.updatedAt=Date.now();return p}
export function validateProject(p){if(!p||!p.id||!p.name||!Array.isArray(p.files)||!Array.isArray(p.directories))throw Error('Invalid project format.');return p}
export function starter(name='Welcome'){const p=createProject(name);createFile(p,'index.html','<!doctype html>\n<html>\n  <head><link rel="stylesheet" href="style.css"></head>\n  <body><main><h1>Welcome to Forge</h1><p>Start building.</p></main><script src="script.js"></script></body>\n</html>');createFile(p,'style.css','body { background: #111827; color: #e5e7eb; font: 16px system-ui; padding: 3rem; }\nmain { max-width: 42rem; margin: auto; }');createFile(p,'script.js',"console.log('Forge is ready');");return p}
