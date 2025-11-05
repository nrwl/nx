export function getEnvPathsForTask(
  projectRoot: string,
  target: string,
  configuration?: string,
  nonAtomizedTarget?: string
): string[] {
  // Collect dot env files that may pertain to a task
  const envPaths = [];
  // Load DotEnv Files for a configuration in the project root folder
  if (configuration) {
    envPaths.push(
      ...getEnvFileVariants(`${target}.${configuration}`, projectRoot)
    );
    if (nonAtomizedTarget) {
      envPaths.push(
        ...getEnvFileVariants(
          `${nonAtomizedTarget}.${configuration}`,
          projectRoot
        )
      );
    }
    envPaths.push(...getEnvFileVariants(configuration, projectRoot));
  }
  // Load DotEnv Files for a target in the project root folder
  envPaths.push(...getEnvFileVariants(target, projectRoot));
  if (nonAtomizedTarget) {
    envPaths.push(...getEnvFileVariants(nonAtomizedTarget, projectRoot));
  }
  // Load base DotEnv Files at project root
  envPaths.push(
    ...[
      `${projectRoot}/.env.local`,
      `${projectRoot}/.local.env`,
      `${projectRoot}/.env`,
    ]
  );

  // Load DotEnv Files for a configuration in the workspace root
  if (configuration) {
    envPaths.push(...getEnvFileVariants(`${target}.${configuration}`));
    if (nonAtomizedTarget) {
      envPaths.push(
        ...getEnvFileVariants(`${nonAtomizedTarget}.${configuration}`)
      );
    }
    envPaths.push(...getEnvFileVariants(configuration));
  }
  // Load DotEnv Files for a target in the workspace root folder
  envPaths.push(...getEnvFileVariants(target));
  if (nonAtomizedTarget) {
    envPaths.push(...getEnvFileVariants(nonAtomizedTarget));
  }

  // Load base DotEnv Files at workspace root
  envPaths.push(...[`.env.local`, `.local.env`, `.env`]);

  return envPaths;
}

function getEnvFileVariants(identifier: string, root?: string) {
  const path = root ? root + '/' : '';
  return [
    `${path}.env.${identifier}.local`,
    `${path}.env.${identifier}`,
    `${path}.${identifier}.local.env`,
    `${path}.${identifier}.env`,
  ];
}
