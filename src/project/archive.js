import { validateProject, LIMITS } from './project.js';

export function exportProject(project) {
  const blob = new Blob([JSON.stringify(project, null, 2)], { type: 'application/json' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${project.name.replace(/[^\w-]/g, '-')}.forge-project.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 0);
}

export async function importProject(file) {
  try {
    if (!file || file.size > LIMITS.maxProjectBytes * 1.2) throw Error('Archive exceeds the import size limit.');
    const project = JSON.parse(await file.text());
    return validateProject(project);
  } catch {
    throw Error('Invalid project archive or the archive exceeds Forge limits.');
  }
}
