"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.getEnvPathsForTask = getEnvPathsForTask;
function getEnvPathsForTask(projectRoot, target, configuration, nonAtomizedTarget) {
    const identifiers = [];
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
function getEnvFileVariants(identifier, root) {
    const path = root ? root + '/' : '';
    if (identifier) {
        return [
            `${path}.env.${identifier}.local`,
            `${path}.env.${identifier}`,
            `${path}.${identifier}.local.env`,
            `${path}.${identifier}.env`,
        ];
    }
    else {
        return [`${path}.env.local`, `${path}.local.env`, `${path}.env`];
    }
}
