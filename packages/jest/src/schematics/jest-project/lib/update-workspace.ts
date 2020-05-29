import { join, normalize } from '@angular-devkit/core';
import { Rule } from '@angular-devkit/schematics';
import { updateWorkspaceInTree } from '@nrwl/workspace';
import { JestProjectSchema } from '../schema';

export function updateWorkspace(options: JestProjectSchema): Rule {
  return updateWorkspaceInTree((json) => {
    const projectConfig = json.projects[options.project];
    projectConfig.architect.test = {
      builder: '@nrwl/jest:jest',
      options: {
        jestConfig: join(normalize(projectConfig.root), 'jest.config.js'),
        tsConfig: join(normalize(projectConfig.root), 'tsconfig.spec.json'),
        passWithNoTests: true,
      },
    };
    if (options.setupFile !== 'none') {
      projectConfig.architect.test.options.setupFile = join(
        normalize(projectConfig.root),
        'src/test-setup.ts'
      );
    }
    if (projectConfig.architect.lint) {
      projectConfig.architect.lint.options.tsConfig = [
        ...projectConfig.architect.lint.options.tsConfig,
        join(normalize(projectConfig.root), 'tsconfig.spec.json'),
      ];
    }
    return json;
  });
}
