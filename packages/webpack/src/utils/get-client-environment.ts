// Prevent sensitive keys from being bundled when source code uses entire `process.env` object rather than individual keys (e.g. `process.env.NX_FOO`).
// TODO(v19): Only env vars prefixed with NX_PUBLIC should be bundled. This is a breaking change so we won't do it in v18.
const excludedKeys = ['NX_CLOUD_ACCESS_TOKEN', 'NX_CLOUD_ENCRYPTION_KEY'];

export function getClientEnvironment(mode?: string) {
  // Grab NODE_ENV and NX_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const NX_APP = /^NX_/i;

  const raw = Object.keys(process.env)
    .filter((key) => !excludedKeys.includes(key) && NX_APP.test(key))
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      // If mode is undefined or is dev or prod then webpack already defines this variable for us.
      !mode || mode === 'development' || mode === 'production'
        ? {}
        : {
            NODE_ENV: process.env.NODE_ENV,
          }
    );

  // Stringify all values so we can feed into webpack DefinePlugin
  const stringified = {
    'process.env': Object.keys(raw).reduce((env, key) => {
      env[key] = JSON.stringify(raw[key]);
      return env;
    }, {}),
  };

  return { stringified };
}
