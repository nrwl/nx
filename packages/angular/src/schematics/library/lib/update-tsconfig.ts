import { chain, Rule, SchematicsException } from '@angular-devkit/schematics';
import { updateJsonInTree } from '@nrwl/workspace';
import { NormalizedSchema } from './normalized-schema';

function updateRootConfig(options: NormalizedSchema) {
  return updateJsonInTree('tsconfig.base.json', (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    delete c.paths[options.name];

    if (c.paths[options.importPath]) {
      throw new SchematicsException(
        `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
      );
    }

    c.paths[options.importPath] = [
      `libs/${options.projectDirectory}/src/index.ts`,
    ];

    return json;
  });
}

function updateProjectConfig(options: NormalizedSchema) {
  return updateJsonInTree(
    `${options.projectRoot}/tsconfig.lib.json`,
    (json) => {
      json.include = ['**/*.ts'];
      return json;
    }
  );
}

export function updateTsConfig(options: NormalizedSchema): Rule {
  return chain([updateRootConfig(options), updateProjectConfig(options)]);
}
