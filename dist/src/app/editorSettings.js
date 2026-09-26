export function editorCssVariables(settings) {
  return {
    '--font-size': `${settings.fontSize}px`,
    '--tab-size': String(settings.tabSize),
    '--editor-white-space': settings.wordWrap ? 'pre-wrap' : 'pre'
  };
}
