import { chain, noop, Rule, Tree } from '@angular-devkit/schematics';
import { formatFiles, updateJsonInTree } from '@nrwl/workspace';

export default function (): Rule {
  return (host: Tree) => {
    if (!host.exists('.eslintrc')) {
      return noop();
    } else {
      return chain([
        updateJsonInTree('.eslintrc', (json) => {
          const tsconfig = json?.parserOptions?.project;
          if (tsconfig && tsconfig === './tsconfig.base.json') {
            json.parserOptions.project = json.parserOptions.project.replace(
              /tsconfig.base.json$/,
              'tsconfig.*?.json'
            );
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
