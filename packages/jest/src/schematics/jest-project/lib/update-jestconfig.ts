import { Rule, Tree } from '@angular-devkit/schematics';
import { getWorkspace } from '@nrwl/workspace';

import { JestProjectSchema } from '../schema';
import { addPropertyToJestConfig } from '../../../utils/config/update-config';

export function updateJestConfig(options: JestProjectSchema): Rule {
  return async (host: Tree) => {
    const workspace = await getWorkspace(host);
    const project = workspace.projects.get(options.project);
    addPropertyToJestConfig(
      host,
      'jest.config.js',
      'projects',
      `<rootDir>/${project.root}`
    );
  };
}
