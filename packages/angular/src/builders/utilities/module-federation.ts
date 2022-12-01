import { ProjectConfiguration } from 'nx/src/config/workspace-json-project-json';
import { BuilderContext } from '@angular-devkit/architect';
import { join } from 'path';
import { existsSync, readFileSync } from 'fs';
import { Remotes } from '@nrwl/devkit';

export function getDynamicRemotes(
  project: ProjectConfiguration,
  context: BuilderContext,
  workspaceProjects: Record<string, ProjectConfiguration>,
  remotesToSkip: Set<string>
): string[] {
  // check for dynamic remotes
  // we should only check for dynamic based on what we generate
  // and fallback to empty array

  const standardPathToGeneratedMFManifestJson = join(
    context.workspaceRoot,
    project.sourceRoot,
    'assets/module-federation.manifest.json'
  );
  if (!existsSync(standardPathToGeneratedMFManifestJson)) {
    return [];
  }

  const moduleFederationManifestJson = readFileSync(
    standardPathToGeneratedMFManifestJson,
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

  const dynamicRemotes = Object.entries(parsedManifest)
    .map(([remoteName]) => remoteName)
    .filter((r) => !remotesToSkip.has(r));
  const invalidDynamicRemotes = dynamicRemotes.filter(
    (remote) => !workspaceProjects[remote]
  );
  if (invalidDynamicRemotes.length) {
    throw new Error(
      invalidDynamicRemotes.length === 1
        ? `Invalid dynamic remote configured in "${standardPathToGeneratedMFManifestJson}": ${invalidDynamicRemotes[0]}.`
        : `Invalid dynamic remotes configured in "${standardPathToGeneratedMFManifestJson}": ${invalidDynamicRemotes.join(
            ', '
          )}.`
    );
  }

  return dynamicRemotes;
}

export function getStaticRemotes(
  project: ProjectConfiguration,
  context: BuilderContext,
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
      `Could not load ${mfConfigPath}. Was this project generated with "@nrwl/angular:host"?`
    );
  }

  const remotesConfig = mfeConfig.remotes.length > 0 ? mfeConfig.remotes : [];
  const staticRemotes = remotesConfig
    .map((remoteDefinition) =>
      Array.isArray(remoteDefinition) ? remoteDefinition[0] : remoteDefinition
    )
    .filter((r) => !remotesToSkip.has(r));

  const invalidStaticRemotes = staticRemotes.filter(
    (remote) => !workspaceProjects[remote]
  );
  if (invalidStaticRemotes.length) {
    throw new Error(
      invalidStaticRemotes.length === 1
        ? `Invalid static remote configured in "${mfConfigPath}": ${invalidStaticRemotes[0]}.`
        : `Invalid static remotes configured in "${mfConfigPath}": ${invalidStaticRemotes.join(
            ', '
          )}.`
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
