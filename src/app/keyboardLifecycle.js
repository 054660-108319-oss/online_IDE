const installedListeners = new WeakMap();

export function installKeyboardListener(documentRef, listener) {
  if (installedListeners.has(documentRef)) return installedListeners.get(documentRef);
  documentRef.addEventListener('keydown', listener);
  const cleanup = () => {
    documentRef.removeEventListener('keydown', listener);
    installedListeners.delete(documentRef);
  };
  installedListeners.set(documentRef, cleanup);
  return cleanup;
}
