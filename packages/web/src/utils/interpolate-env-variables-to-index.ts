export function interpolateEnvironmentVariablesToIndex(
  contents: string,
  deployUrl?: string
): string {
  const environmentVariables = getClientEnvironment(deployUrl || '');
  return interpolateEnvironmentVariables(contents, environmentVariables as any);
}

const NX_PREFIX = /^NX_/i;

function isNxEnvironmentKey(x: string): boolean {
  return NX_PREFIX.test(x);
}

function getClientEnvironment(deployUrl: string) {
  return Object.keys(process.env)
    .filter(isNxEnvironmentKey)
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        NODE_ENV: process.env.NODE_ENV || 'development',
        DEPLOY_URL: deployUrl || process.env.DEPLOY_URL || '',
      }
    );
}

function interpolateEnvironmentVariables(
  documentContents: string,
  environmentVariables: Record<string, string>
): string {
  let temp = documentContents;
  for (const [key, value] of Object.entries(environmentVariables)) {
    temp = temp.replace(new RegExp(`%${key}%`, 'g'), value);
  }
  return temp;
}
