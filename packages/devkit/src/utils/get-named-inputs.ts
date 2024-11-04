import { join } from 'path';
import { existsSync } from 'fs';

import type { PackageJson } from 'nx/src/utils/package-json';
import type { InputDefinition } from 'nx/src/config/workspace-json-project-json';

import {
  CreateNodesContext,
  CreateNodesContextV2,
  ProjectConfiguration,
  readJsonFile,
} from 'nx/src/devkit-exports';

/**
 * Get the named inputs available for a directory
 */
export function getNamedInputs(
  directory: string,
  context: CreateNodesContext | CreateNodesContextV2
): { [inputName: string]: (string | InputDefinition)[] } {
  const projectJsonPath = join(directory, 'project.json');
  const projectJson: ProjectConfiguration = existsSync(projectJsonPath)
    ? readJsonFile(projectJsonPath)
    : null;

  const packageJsonPath = join(directory, 'package.json');
  const packageJson: PackageJson = existsSync(packageJsonPath)
    ? readJsonFile(packageJsonPath)
    : null;

  return {
    ...context.nxJsonConfiguration.namedInputs,
    ...packageJson?.nx?.namedInputs,
    ...projectJson?.namedInputs,
  };
}
