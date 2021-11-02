import { Tree, updateJson } from '@nrwl/devkit';
import { NormalizedSchema } from './normalized-schema';

export function updateLibPackageNpmScope(
  host: Tree,
  options: NormalizedSchema
) {
  return updateJson(host, `${options.projectRoot}/package.json`, (json) => {
    json.name = options.importPath;
    return json;
  });
}
