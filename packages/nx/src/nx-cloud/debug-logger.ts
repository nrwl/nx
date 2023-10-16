export function debugLog(...args: any[]) {
  if (process.env['NX_VERBOSE_LOGGING'] === 'true') {
    console.log('[NX CLOUD]', ...args);
  }
}
