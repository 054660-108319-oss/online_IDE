export class WebExecutionProvider {
  async run(project, onLine) {
    const start = performance.now();
    const html = project.files.find(file => file.path === 'index.html')?.content;
    if (!html) throw Error('No index.html found. Web preview requires an HTML entry point.');
    onLine('stdout', 'Preview built successfully.');
    return { status: 'completed', exitCode: 0, duration: performance.now() - start, html: this.bundle(project, html) };
  }

  bundle(project, html) {
    const find = path => project.files.find(file => file.path === path.replace(/^\.\//, ''));
    return html
      .replace(/<link\b[^>]*\bhref=["']([^"']+\.css)["'][^>]*>/gi, (tag, path) => {
        const file = find(path); return file ? `<style data-forge-source="${path}">${file.content}</style>` : tag;
      })
      .replace(/<script\b[^>]*\bsrc=["']([^"']+\.js)["'][^>]*><\/script>/gi, (tag, path) => {
        const file = find(path); return file ? `<script data-forge-source="${path}">${file.content}<\/script>` : tag;
      });
  }
}

export class SandboxExecutionProvider {
  async run(project) {
    const file = project.files.find(item => /\.(py|kt|ts|tsx|jsx)$/.test(item.path));
    throw Error(`${file?.path?.split('.').pop().toUpperCase() || 'This'} runtime is not available in this browser. Use a remote sandbox provider to execute it.`);
  }
}

export class ExecutionService {
  constructor() { this.web = new WebExecutionProvider(); this.sandbox = new SandboxExecutionProvider(); }
  async run(project, onLine) { return project.files.some(file => file.path === 'index.html') ? this.web.run(project, onLine) : this.sandbox.run(project, onLine); }
}
