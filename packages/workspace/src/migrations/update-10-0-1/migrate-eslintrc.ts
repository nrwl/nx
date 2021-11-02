import { basename, dirname, join } from '@angular-devkit/core';
import { chain, Rule } from '@angular-devkit/schematics';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';
import { visitNotIgnoredFiles } from '../../utils/rules/visit-not-ignored-files';

export default function (schema: any): Rule {
  return chain([
    visitNotIgnoredFiles((file, host, context) => {
      if (basename(file) !== '.eslintrc') {
        return;
      }

      return (host, context) => {
        try {
          updateJsonInTree(file, (json) => {
            const tsconfig = json?.parserOptions?.project;
            if (tsconfig) {
              const tsconfigPath = join(dirname(file), tsconfig);
              if (tsconfigPath === 'tsconfig.json') {
                json.parserOptions.project = json.parserOptions.project.replace(
                  /tsconfig.json$/,
                  'tsconfig.base.json'
                );
              }
              return json;
            } else {
              return json;
            }
          })(host, context);
        } catch (e) {
          context.logger.warn(
            `${file} could not be migrated because it is not valid JSON`
          );
          context.logger.error(e);
        }
      };
    }),
    formatFiles(),
  ]);
}
