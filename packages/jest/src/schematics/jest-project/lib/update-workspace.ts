import { join, normalize } from '@angular-devkit/core';
import { Rule } from '@angular-devkit/schematics';
import { updateWorkspaceInTree } from '@nrwl/workspace';
import { JestProjectSchema } from '../schema';

export function updateWorkspace(options: JestProjectSchema): Rule {
  return updateWorkspaceInTree((json) => {
    const projectConfig = json.projects[options.project];
    projectConfig.architect.test = {
      builder: '@nrwl/jest:jest',
      outputs: [join(normalize('coverage'), normalize(projectConfig.root))],
      options: {
        jestConfig: join(normalize(projectConfig.root), 'jest.config.js'),
        passWithNoTests: true,
      },
    };

    const isUsingTSLint =
      projectConfig.architect.lint?.builder ===
      '@angular-devkit/build-angular:tslint';

    if (isUsingTSLint) {
      projectConfig.architect.lint.options.tsConfig = [
        ...projectConfig.architect.lint.options.tsConfig,
        join(normalize(projectConfig.root), 'tsconfig.spec.json'),
      ];
    }
    return json;
  });
}
