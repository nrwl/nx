import { basename, dirname, join } from '@angular-devkit/core';
import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';
import { visitNotIgnoredFiles } from '../../utils/rules/visit-not-ignored-files';

export default function (): Rule {
  return chain([
    visitNotIgnoredFiles((file) => {
      if (basename(file) !== '.eslintrc') {
        return;
      }

      return updateJsonInTree(file, (json) => {
        const tsconfig = json?.parserOptions?.project;
        if (tsconfig) {
          const tsconfigPath = join(dirname(file), tsconfig);
          if (tsconfigPath === 'tsconfig.base.json') {
            json.parserOptions.project = json.parserOptions.project.replace(
              /tsconfig.base.json$/,
              'tsconfig.*.json'
            );
          }
          return json;
        } else {
          return json;
        }
      });
    }),
    formatFiles(),
  ]);
}
