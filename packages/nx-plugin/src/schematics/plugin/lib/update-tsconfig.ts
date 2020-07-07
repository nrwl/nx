import { Rule, Tree } from '@angular-devkit/schematics';
import { getProjectConfig, updateJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema } from '../schema';

export function updateTsConfig(options: NormalizedSchema): Rule {
  return (host: Tree) => {
    const projectConfig = getProjectConfig(host, options.name);
    return updateJsonInTree(
      `${projectConfig.root}/tsconfig.lib.json`,
      (json) => {
        json.compilerOptions.rootDir = '.';
        return json;
      }
    );
  };
}
