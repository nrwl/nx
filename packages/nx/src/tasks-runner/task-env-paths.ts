export function getEnvPathsForTask(
  projectRoot: string,
  target: string,
  configuration?: string,
  nonAtomizedTarget?: string
): string[] {
  const identifiers: string[] = [];
  // Configuration-specific identifier (like build.development, build.production)
  if (configuration) {
    identifiers.push(`${target}.${configuration}`);
    if (nonAtomizedTarget) {
      identifiers.push(`${nonAtomizedTarget}.${configuration}`);
    }
    identifiers.push(configuration);
  }
  // Non-configuration-specific identifier (like build, test, serve)
  identifiers.push(target);
  if (nonAtomizedTarget) {
    identifiers.push(nonAtomizedTarget);
  }
  // Non-deterministic identifier (for files like .env.local, .local.env, .env)
  identifiers.push('');

  const envPaths = [];
  // Add DotEnv Files in the project root folder
  for (const identifier of identifiers) {
    envPaths.push(...getEnvFileVariants(identifier, projectRoot));
  }
  // Add DotEnv Files in the workspace root folder
  for (const identifier of identifiers) {
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
