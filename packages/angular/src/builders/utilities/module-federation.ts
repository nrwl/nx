import { basename, dirname, join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { logger, ProjectConfiguration } from '@nx/devkit';
import { registerTsProject } from '@nx/js/src/internal';

export function getDynamicRemotes(
  project: ProjectConfiguration,
  context: import('@angular-devkit/architect').BuilderContext,
  workspaceProjects: Record<string, ProjectConfiguration>,
  remotesToSkip: Set<string>,
  pathToManifestFile = join(
    context.workspaceRoot,
    project.sourceRoot,
    'assets/module-federation.manifest.json'
  )
): string[] {
  // check for dynamic remotes
  // we should only check for dynamic based on what we generate
  // and fallback to empty array

  if (!existsSync(pathToManifestFile)) {
    return [];
  }

  const moduleFederationManifestJson = readFileSync(
    pathToManifestFile,
    'utf-8'
  );

  if (!moduleFederationManifestJson) {
    return [];
  }

  // This should have shape of
  // {
  //   "remoteName": "remoteLocation",
  // }
  const parsedManifest = JSON.parse(moduleFederationManifestJson);
  if (
    !Object.keys(parsedManifest).every(
      (key) =>
        typeof key === 'string' && typeof parsedManifest[key] === 'string'
    )
  ) {
    return [];
  }

  const allDynamicRemotes = Object.entries(parsedManifest)
    .map(([remoteName]) => remoteName)
    .filter((r) => !remotesToSkip.has(r));

  const remotesNotInWorkspace: string[] = [];

  const dynamicRemotes = allDynamicRemotes.filter((remote) => {
    if (!workspaceProjects[remote]) {
      remotesNotInWorkspace.push(remote);

      return false;
    }
    return true;
  });

  if (remotesNotInWorkspace.length > 0) {
    logger.warn(
      `Skipping serving ${remotesNotInWorkspace.join(
        ', '
      )} as they could not be found in the workspace. Ensure they are served correctly.`
    );
  }

  return dynamicRemotes;
}

function getModuleFederationConfig(
  tsconfigPath: string,
  workspaceRoot: string,
  projectRoot: string
) {
  const moduleFederationConfigPathJS = join(
    workspaceRoot,
    projectRoot,
    'module-federation.config.js'
  );

  const moduleFederationConfigPathTS = join(
    workspaceRoot,
    projectRoot,
    'module-federation.config.ts'
  );

  let moduleFederationConfigPath = moduleFederationConfigPathJS;

  let cleanupTranspiler = () => {};
  if (existsSync(moduleFederationConfigPathTS)) {
    cleanupTranspiler = registerTsProject(join(workspaceRoot, tsconfigPath));
    moduleFederationConfigPath = moduleFederationConfigPathTS;
  }

  try {
    const config = require(moduleFederationConfigPath);
    cleanupTranspiler();

    return {
      mfeConfig: config.default || config,
      mfConfigPath: moduleFederationConfigPath,
    };
  } catch {
    throw new Error(
      `Could not load ${moduleFederationConfigPath}. Was this project generated with "@nx/angular:host"?`
    );
  }
}

export function getStaticRemotes(
  project: ProjectConfiguration,
  context: import('@angular-devkit/architect').BuilderContext,
  workspaceProjects: Record<string, ProjectConfiguration>,
  remotesToSkip: Set<string>
): string[] {
  const { mfeConfig, mfConfigPath } = getModuleFederationConfig(
    project.targets.build.options.tsConfig,
    context.workspaceRoot,
    project.root
  );

  const remotesConfig =
    Array.isArray(mfeConfig.remotes) && mfeConfig.remotes.length > 0
      ? mfeConfig.remotes
      : [];
  const allStaticRemotes = remotesConfig
    .map((remoteDefinition) =>
      Array.isArray(remoteDefinition) ? remoteDefinition[0] : remoteDefinition
    )
    .filter((r) => !remotesToSkip.has(r));
  const remotesNotInWorkspace: string[] = [];

  const staticRemotes = allStaticRemotes.filter((remote) => {
    if (!workspaceProjects[remote]) {
      remotesNotInWorkspace.push(remote);

      return false;
    }
    return true;
  });

  if (remotesNotInWorkspace.length > 0) {
    logger.warn(
      `Skipping serving ${remotesNotInWorkspace.join(
        ', '
      )} as they could not be found in the workspace. Ensure they are served correctly.`
    );
  }

  return staticRemotes;
}

export function validateDevRemotes(
  options: { devRemotes?: string[] },
  workspaceProjects: Record<string, ProjectConfiguration>
): void {
  const invalidDevRemotes =
    options.devRemotes?.filter((remote) => !workspaceProjects[remote]) ?? [];

  if (invalidDevRemotes.length) {
    throw new Error(
      invalidDevRemotes.length === 1
        ? `Invalid dev remote provided: ${invalidDevRemotes[0]}.`
        : `Invalid dev remotes provided: ${invalidDevRemotes.join(', ')}.`
    );
  }
}
