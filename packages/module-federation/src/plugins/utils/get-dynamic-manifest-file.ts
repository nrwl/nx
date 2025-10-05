import { type ProjectConfiguration } from '@nx/devkit';
import { getProjectSourceRoot } from '@nx/js/src/utils/typescript/ts-solution-setup';
import { existsSync } from 'fs';
import { join } from 'path';

export function getDynamicMfManifestFile(
  project: ProjectConfiguration,
  workspaceRoot: string
): string | undefined {
  // {sourceRoot}/assets/module-federation.manifest.json was the generated
  // path for the manifest file in the past. We now generate the manifest
  // file at {root}/public/module-federation.manifest.json. This check
  // ensures that we can still support the old path for backwards
  // compatibility since old projects may still have the manifest file
  // at the old path.
  return [
    join(workspaceRoot, project.root, 'public/module-federation.manifest.json'),
    join(
      workspaceRoot,
      getProjectSourceRoot(project),
      'assets/module-federation.manifest.json'
    ),
  ].find((path) => existsSync(path));
}
