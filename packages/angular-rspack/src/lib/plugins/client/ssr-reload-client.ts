// This function is serialized into HTML and cannot reference module-scoped values.
export function connectSsrReload(port: number) {
  const socket = new WebSocket(`ws://${globalThis.location.hostname}:${port}`);
  let reloading = false;

  async function reloadWhenReady() {
    try {
      await fetch(globalThis.location.href, {
        cache: 'no-store',
        mode: 'no-cors',
      });
    } catch {
      setTimeout(reloadWhenReady, 100);
      return;
    }
    reloading = false;
    globalThis.location.reload();
  }

  socket.addEventListener('message', (event) => {
    if (event.data === 'ssr-reload' && !reloading) {
      reloading = true;
      console.log('[AngularSSRDevServer] Reloading the page...');
      void reloadWhenReady();
    }
  });

  socket.addEventListener('open', () => {
    console.log('[AngularSSRDevServer] WebSocket connection established.');
  });

  socket.addEventListener('close', () => {
    console.warn('[AngularSSRDevServer] WebSocket connection closed.');
  });
}
