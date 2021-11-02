import { chain, SchematicContext, Tree } from '@angular-devkit/schematics';
import { formatFiles } from '../../utils/rules/format-files';
import { updateBuilderConfig, updateWorkspace } from '../../utils/workspace';
import { JsonArray } from '@angular-devkit/core';

function updateExcludePattern(host: Tree, context: SchematicContext) {
  const builders = [
    '@nrwl/linter:lint',
    '@angular-devkit/build-angular:tslint',
  ];
  return updateBuilderConfig((options, target, project) => {
    if (!options?.exclude) {
      return options;
    }
    const faultyPattern = `!${project.root}/**`;
    if ((options?.exclude as JsonArray).includes(faultyPattern)) {
      const index: number = (options?.exclude as JsonArray).indexOf(
        faultyPattern
      );
      (options?.exclude as JsonArray)[index] = `${faultyPattern}/*`;
    }
    return options;
  }, ...builders);
}

export default function () {
  return chain([updateExcludePattern, formatFiles()]);
}
