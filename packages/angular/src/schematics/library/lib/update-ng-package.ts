import { chain, noop, Rule, Tree } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { libsDir } from '@nrwl/workspace/src/utils/ast-utils';
import { NormalizedSchema } from './normalized-schema';
import { offsetFromRoot } from '@nrwl/devkit';

export function updateNgPackage(host: Tree, options: NormalizedSchema): Rule {
  if (!(options.publishable || options.buildable)) {
    return noop();
  }
  const dest = `${offsetFromRoot(options.projectRoot)}dist/${libsDir(host)}/${
    options.projectDirectory
  }`;
  return chain([
    updateJsonInTree(`${options.projectRoot}/ng-package.json`, (json) => {
      let $schema = json.$schema;
      if (json.$schema && json.$schema.indexOf('node_modules') >= 0) {
        $schema = `${offsetFromRoot(
          options.projectRoot
        )}${json.$schema.substring(
          json.$schema.indexOf('node_modules'),
          json.$schema.length
        )}`;
      }
      return {
        ...json,
        dest,
        $schema,
      };
    }),
  ]);
}
