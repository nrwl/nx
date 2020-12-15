import { join, normalize } from '@angular-devkit/core';
import { chain, Rule } from '@angular-devkit/schematics';
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';
import {
  addLintFiles,
  generateProjectLint,
  updateWorkspaceInTree,
} from '@nrwl/workspace';
import { Schema } from './schema';

export default function addLintingToApplication(options: Schema): Rule {
  return chain([
    addLintFiles(options.projectRoot, options.linter),
    updateWorkspaceInTree((workspaceJson) => {
      workspaceJson.projects[
        options.projectName
      ].architect.lint = generateProjectLint(
        normalize(options.projectRoot),
        join(normalize(options.projectRoot), 'tsconfig.app.json'),
        options.linter,
        [`${options.projectRoot}/**/*.${options.js ? 'js' : 'ts'}`]
      );
      return workspaceJson;
    }),
  ]);
}

export const addLintingToApplicationGenerator = wrapAngularDevkitSchematic(
  '@nrwl/node',
  'add-linting-to-application'
);
