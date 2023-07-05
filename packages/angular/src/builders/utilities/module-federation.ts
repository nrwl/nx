import { ProjectConfiguration } from 'nx/src/config/workspace-json-project-json';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { logger, Remotes } from '@nx/devkit';

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

export function getStaticRemotes(
  project: ProjectConfiguration,
  context: import('@angular-devkit/architect').BuilderContext,
  workspaceProjects: Record<string, ProjectConfiguration>,
  remotesToSkip: Set<string>
): string[] {
  const mfConfigPath = join(
    context.workspaceRoot,
    project.root,
    'module-federation.config.js'
  );

  let mfeConfig: { remotes: Remotes };
  try {
    mfeConfig = require(mfConfigPath);
  } catch {
    throw new Error(
      `Could not load ${mfConfigPath}. Was this project generated with "@nx/angular:host"?`
    );
  }

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
  const invalidDevRemotes = options.devRemotes?.filter(
    (remote) => !workspaceProjects[remote]
  );

  if (invalidDevRemotes.length) {
    throw new Error(
      invalidDevRemotes.length === 1
        ? `Invalid dev remote provided: ${invalidDevRemotes[0]}.`
        : `Invalid dev remotes provided: ${invalidDevRemotes.join(', ')}.`
    );
  }
}
