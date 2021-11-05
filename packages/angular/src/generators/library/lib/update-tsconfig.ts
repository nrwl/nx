import { getWorkspaceLayout, Tree, updateJson } from '@nrwl/devkit';
import { NormalizedSchema } from './normalized-schema';

function updateRootConfig(host: Tree, options: NormalizedSchema) {
  updateJson(host, 'tsconfig.base.json', (json) => {
    const c = json.compilerOptions;
    c.paths = c.paths || {};
    delete c.paths[options.name];

    if (c.paths[options.importPath]) {
      throw new Error(
        `You already have a library using the import path "${options.importPath}". Make sure to specify a unique one.`
      );
    }

    c.paths[options.importPath] = [
      `${getWorkspaceLayout(host).libsDir}/${
        options.projectDirectory
      }/src/index.ts`,
    ];

    return json;
  });
}

function updateProjectConfig(host: Tree, options: NormalizedSchema) {
  updateJson(host, `${options.projectRoot}/tsconfig.lib.json`, (json) => {
    json.include = ['**/*.ts'];
    json.exclude = [
      ...new Set([...(json.exclude || []), '**/*.test.ts', '**/*.spec.ts']),
    ];
    return json;
  });
}

function updateProjectProdConfig(host: Tree, options: NormalizedSchema) {
  if (options.enableIvy) {
    return updateJson(
      host,
      `${options.projectRoot}/tsconfig.lib.prod.json`,
      (json) => {
        json.angularCompilerOptions['enableIvy'] = true;
        return json;
      }
    );
  }
}

export function updateTsConfig(host: Tree, options: NormalizedSchema) {
  updateRootConfig(host, options);
  updateProjectConfig(host, options);
  updateProjectProdConfig(host, options);
}
