import { Tree, updateJson } from '@nrwl/devkit';
import { NormalizedSchema } from './normalized-schema';

export function updateLibPackageNpmScope(
  host: Tree,
  options: NormalizedSchema
) {
  let pkgName = options.importPath;

  const scopeParts = options.importPath.split('/');
  if (scopeParts.length > 2) {
    const prefix = scopeParts.shift();
    const name = scopeParts.join('-');
    pkgName = `${prefix}/${name}`;
  }

  return updateJson(host, `${options.projectRoot}/package.json`, (json) => {
    json.name = pkgName;
    return json;
  });
}
