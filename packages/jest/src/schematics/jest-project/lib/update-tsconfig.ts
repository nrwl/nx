import { join } from '@angular-devkit/core';
import { Rule, Tree } from '@angular-devkit/schematics';
import { getProjectConfig, updateJsonInTree } from '@nrwl/workspace';
import { JestProjectSchema } from '../schema';

export function updateTsConfig(options: JestProjectSchema): Rule {
  return (host: Tree) => {
    const projectConfig = getProjectConfig(host, options.project);
    if (!host.exists(join(projectConfig.root, 'tsconfig.json'))) {
      throw new Error(
        `Expected ${join(
          projectConfig.root,
          'tsconfig.json'
        )} to exist. Please create one.`
      );
    }
    return updateJsonInTree(
      join(projectConfig.root, 'tsconfig.json'),
      (json) => {
        if (json.references) {
          json.references.push({
            path: './tsconfig.spec.json',
          });
        }
        return json;
      }
    );
  };
}
