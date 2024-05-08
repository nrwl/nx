export function getClientEnvironment(mode?: string) {
  // Grab NODE_ENV and NX_PUBLIC_* environment variables and prepare them to be
  // injected into the application via DefinePlugin in webpack configuration.
  const nxPublicKeyRegex = /^NX_PUBLIC_/i;

  const raw = Object.keys(process.env)
    .filter((key) => nxPublicKeyRegex.test(key))
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
