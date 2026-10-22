// Captured when the daemon starts, before plugins or sync generators can
// replace it (e.g. @swc-node/register compiles every .js outside node_modules).
const nativeJsLoader = require.extensions?.['.js'];

export function requireWithNativeJsLoader(path: string) {
  // Undefined when a loader hook (e.g. Yarn PnP's) has Node's ESM loader run
  // nx's CommonJS. The require nx gets there never runs .js hooks.
  if (!nativeJsLoader) {
    return require(path);
  }
  const currentJsLoader = require.extensions['.js'];
  require.extensions['.js'] = nativeJsLoader;
  try {
    return require(path);
  } finally {
    require.extensions['.js'] = currentJsLoader;
  }
}
