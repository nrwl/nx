import { Tree, updateJson } from '@nx/devkit';
import { NormalizedSchema } from './normalize-options';

export function updateCypressTsConfig(host: Tree, options: NormalizedSchema) {
  if (options.e2eTestRunner !== 'cypress' || !options.rootProject) {
    return;
  }

  updateJson(
    host,
    `${options.e2eProjectRoot}/${options.e2eProjectName}/tsconfig.json`,
    (json) => {
      return {
        ...json,
        exclude: [],
      };
    }
  );
}
