export function getEnvPathsForTask(
  projectRoot: string,
  target: string,
  configuration?: string,
  nonAtomizedTarget?: string
): string[] {
  const indentifiers = [];
  // Configuration-specific identifier (like build.development, build.production)
  if (configuration) {
    indentifiers.push(`${target}.${configuration}`);
    if (nonAtomizedTarget) {
      indentifiers.push(`${nonAtomizedTarget}.${configuration}`);
    }
    indentifiers.push(configuration);
  }
  // Non-configuration-specific identifier (like build, test, serve)
  indentifiers.push(target);
  if (nonAtomizedTarget) {
    indentifiers.push(nonAtomizedTarget);
  }
  // Non-deterministic identifier (for files like .env.local, .local.env, .env)
  indentifiers.push('');

  const envPaths = [];
  // Add DotEnv Files in the project root folder
  for (const identifier of indentifiers) {
    envPaths.push(...getEnvFileVariants(identifier, projectRoot));
  }
  // Add DotEnv Files in the workspace root folder
  for (const identifier of indentifiers) {
    envPaths.push(...getEnvFileVariants(identifier));
  }

  return envPaths;
}

function getEnvFileVariants(identifier: string, root?: string) {
  const path = root ? root + '/' : '';
  if (identifier) {
    return [
      `${path}.env.${identifier}.local`,
      `${path}.env.${identifier}`,
      `${path}.${identifier}.local.env`,
      `${path}.${identifier}.env`,
    ];
  } else {
    return [`${path}.env.local`, `${path}.local.env`, `${path}.env`];
  }
}
