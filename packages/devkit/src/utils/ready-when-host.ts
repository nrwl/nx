// A readyWhen fallback starting with one of these reads as a token
const TOKEN_NAMES = new Set([
  'workspaceRoot',
  'projectRoot',
  'projectName',
  'options',
  'env',
]);

/**
 * Returns a dev server's configured host as a literal for a readyWhen
 * fallback, or `localhost` when the host is not a non-empty string.
 */
export function getReadyWhenHost(host: unknown): string {
  if (typeof host !== 'string' || !host) {
    return 'localhost';
  }
  // Host names are case-insensitive, so a capitalized first label names the
  // same host without reading as a token
  const label = host.split('.')[0];
  return TOKEN_NAMES.has(label) ? label[0].toUpperCase() + host.slice(1) : host;
}
