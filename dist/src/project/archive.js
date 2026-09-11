import {validateProject} from './project.js';
export function exportProject(project){const blob=new Blob([JSON.stringify(project,null,2)],{type:'application/json'}),a=document.createElement('a');a.href=URL.createObjectURL(blob);a.download=`${project.name.replace(/[^\w-]/g,'-')}.forge-project.json`;a.click();URL.revokeObjectURL(a.href)}
export async function importProject(file){try{return validateProject(JSON.parse(await file.text()))}catch{throw Error('Invalid project archive. Forge currently imports .forge-project.json exports.')}}
