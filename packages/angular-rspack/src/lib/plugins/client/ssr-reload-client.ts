// @ts-expect-error: This is a client-side file
const socket = new WebSocket(`ws://localhost:60000`);

socket.addEventListener('message', (event) => {
  if (event.data === 'ssr-reload') {
    console.log('[AngularSSRDevServer] Reloading the page...');
    // @ts-expect-error: This is a client-side file
    window.location.reload();
  }
});

socket.addEventListener('open', () => {
  console.log('[AngularSSRDevServer] WebSocket connection established.');
});

socket.addEventListener('close', () => {
  console.warn('[AngularSSRDevServer] WebSocket connection closed.');
});
