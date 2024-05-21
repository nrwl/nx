export function getClientEnvironment(): Record<string, string> {
  const nxPublicKeyRegex = /^NX_PUBLIC_/i;

  return Object.keys(process.env)
    .filter((key) => nxPublicKeyRegex.test(key) || key === 'NODE_ENV')
    .reduce((env, key) => {
      env[`process.env.${key}`] = JSON.stringify(process.env[key]);
      return env;
    }, {});
}
