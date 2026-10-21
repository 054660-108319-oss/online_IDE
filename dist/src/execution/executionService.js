function stripUrlSuffix(path) {
  return path.split(/[?#]/, 1)[0];
}

function resolvePath(basePath, requestedPath) {
  const base = basePath ? basePath.split('/') : [];
  base.pop();
  const parts = stripUrlSuffix(requestedPath).replace(/^\.\//, '').split('/');
  for (const part of parts) {
    if (!part || part === '.') continue;
    if (part === '..') {
      if (!base.length) return null;
      base.pop();
    } else {
      base.push(part);
    }
  }
  return base.join('/');
}

const MAX_PREVIEW_BYTES = 2 * 1024 * 1024;

export class WebExecutionProvider {
  async run(project, onLine) {
    const start = performance.now();
    const html = project.files.find(f => f.path === 'index.html')?.content;
    if (!html) throw Error('No index.html found. Web preview requires an HTML entry point.');
    onLine('stdout', 'Preview built successfully.');
    return {
      status: 'completed',
      exitCode: 0,
      duration: performance.now() - start,
      html: this.bundle(project, html),
    };
  }

  bundle(project, html) {
    const resolve = (documentPath, requestedPath) => {
      const path = resolvePath(documentPath, requestedPath);
      return path ? project.files.find(file => file.path === path) : undefined;
    };

    let bundled = html.replace(
      /<link\b[^>]*\bhref=["']([^"']+)["'][^>]*>/gi,
      (tag, requestedPath) => {
        const file = stripUrlSuffix(requestedPath).endsWith('.css') && resolve('index.html', requestedPath);
        return file ? `<style>\n${file.content}\n</style>` : tag;
      },
    );

    bundled = bundled.replace(
      /<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*><\/script>/gi,
      (tag, requestedPath) => {
        const file = stripUrlSuffix(requestedPath).endsWith('.js') && resolve('index.html', requestedPath);
        if (!file) return tag;
        const safeScript = file.content.replace(/<\/script/gi, '<\\/script');
        return `<script>\n${safeScript}\n</script>`;
      },
    );

    if (new TextEncoder().encode(bundled).byteLength > MAX_PREVIEW_BYTES) {
      throw Error('Preview exceeds the 2 MB size limit.');
    }
    return bundled;
  }
}

export class SandboxExecutionProvider {
  async run(project, onLine) {
    const f = project.files.find(x => /\.(py|kt|ts|tsx|jsx)$/.test(x.path));
    throw Error(`${f?.path?.split('.').pop().toUpperCase() || 'This'} runtime is not available in this browser. Use a remote sandbox provider to execute it.`);
  }
}

export class ExecutionService {
  constructor() {
    this.web = new WebExecutionProvider();
    this.sandbox = new SandboxExecutionProvider();
  }

  async run(project, onLine) {
    return project.files.some(f => f.path === 'index.html')
      ? this.web.run(project, onLine)
      : this.sandbox.run(project, onLine);
  }
}
