export function getClientEnvironment(): Record<string, string> {
  const NX_APP = /^NX_/i;

  return Object.keys(process.env)
    .filter((key) => NX_APP.test(key) || key === 'NODE_ENV')
    .reduce((env, key) => {
      env[`process.env.${key}`] = JSON.stringify(process.env[key]);
      return env;
    }, {});
}
