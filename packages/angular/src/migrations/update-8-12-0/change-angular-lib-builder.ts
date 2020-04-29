import {
  chain,
  Rule,
  SchematicContext,
  Tree,
} from '@angular-devkit/schematics';
import { stripIndents } from '@angular-devkit/core/src/utils/literals';
import { formatFiles } from '@nrwl/workspace/src/utils/rules/format-files';
import { readWorkspaceJson, updateWorkspaceInTree } from '@nrwl/workspace';

export default function (): Rule {
  return chain([
    updateWorkspaceInTree((config) => {
      Object.keys(config.projects).forEach((name) => {
        if (
          config.projects[name].architect &&
          config.projects[name].architect.build &&
          config.projects[name].architect.build.builder ===
            '@angular-devkit/build-ng-packagr:build'
        ) {
          config.projects[name].architect.build.builder =
            '@nrwl/angular:package';
        }
      });
      return config;
    }),
    ,
    formatFiles(),
  ]);
}
