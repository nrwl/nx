// Prevent sensitive keys from being bundled when source code uses entire `process.env` object rather than individual keys (e.g. `process.env.NX_FOO`).
// TODO(v19): Only env vars prefixed with NX_PUBLIC should be bundled. This is a breaking change so we won't do it in v18.
const excludedKeys = ['NX_CLOUD_ACCESS_TOKEN', 'NX_CLOUD_ENCRYPTION_KEY'];

export function getClientEnvironment(): Record<string, string> {
  const NX_APP = /^NX_/i;

  return Object.keys(process.env)
    .filter(
      (key) =>
        !excludedKeys.includes(key) && (NX_APP.test(key) || key === 'NODE_ENV')
    )
    .reduce((env, key) => {
      env[`process.env.${key}`] = JSON.stringify(process.env[key]);
      return env;
    }, {});
}
