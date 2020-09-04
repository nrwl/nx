import { chain, noop, Rule, Tree } from '@angular-devkit/schematics';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';

export default function (): Rule {
  return (host: Tree) => {
    if (!host.exists('.eslintrc')) {
      return noop();
    } else {
      return chain([
        updateJsonInTree('.eslintrc', (json) => {
          const ignorePatterns = json?.ignorePatterns;

          if (
            ignorePatterns &&
            ignorePatterns.length === 1 &&
            ignorePatterns[0] === '!**/*'
          ) {
            json.ignorePatterns = ['/*.*', '!src/**/*'];
            return json;
          } else {
            return json;
          }
        }),
        formatFiles(),
      ]);
    }
  };
}
