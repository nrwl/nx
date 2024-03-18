import { updateJson, type Tree } from '@nx/devkit';
import { tsConfigBaseOptions } from '@nx/js';

export { extractTsConfigBase } from '@nx/js';

export function updateProjectRootTsConfig(
  host: Tree,
  projectRoot: string,
  relativePathToRootTsConfig: string,
  isRootProject?: boolean
) {
  updateJson(host, `${projectRoot}/tsconfig.json`, (json) => {
    if (isRootProject) {
      // inline tsconfig.base.json into the project
      json.compileOnSave = false;
      json.compilerOptions = {
        ...tsConfigBaseOptions,
        ...json.compilerOptions,
      };
      json.exclude = ['node_modules', 'tmp'];
      delete json.extends;
    } else {
      json.extends = relativePathToRootTsConfig;
    }

    return json;
  });
}
