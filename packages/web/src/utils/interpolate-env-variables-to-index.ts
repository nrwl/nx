export function interpolateEnvironmentVariablesToIndex(
  contents: string
): string {
  const environmentVariables = getClientEnvironment('');
  return interpolateEnvironmentVariables(contents, environmentVariables as any);
}

const NX_PREFIX = /^NX_/i;

function isNxEnvironmentKey(x: string): boolean {
  return NX_PREFIX.test(x);
}

function getClientEnvironment(publicUrl: string) {
  return Object.keys(process.env)
    .filter(isNxEnvironmentKey)
    .reduce(
      (env, key) => {
        env[key] = process.env[key];
        return env;
      },
      {
        NODE_ENV: process.env.NODE_ENV || 'development',
        PUBLIC_URL: publicUrl,
        FAST_REFRESH: process.env.FAST_REFRESH !== 'false',
      }
    );
}

function replaceAll(
  contents: string,
  contentsToReplace: string,
  contentsToReplaceWith: string
): string {
  let temp = contents;
  while (temp.includes(contentsToReplace)) {
    temp = temp.replace(contentsToReplace, contentsToReplaceWith);
  }
  return temp;
}

function interpolateEnvironmentVariables(
  documentContents: string,
  environmentVariables: Record<string, string>
): string {
  let temp = documentContents;
  for (const [key, value] of Object.entries(environmentVariables)) {
    temp = replaceAll(temp, `%${key}%`, value);
  }
  return temp;
}
