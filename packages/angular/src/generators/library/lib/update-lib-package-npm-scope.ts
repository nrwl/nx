import { Tree, updateJson } from '@nx/devkit';
import { NormalizedSchema } from './normalized-schema.js';

export function updateLibPackageNpmScope(
  host: Tree,
  options: NormalizedSchema['libraryOptions']
) {
  return updateJson(host, `${options.projectRoot}/package.json`, (json) => {
    json.name = options.importPath;
    return json;
  });
}
