import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';

export function updateTsConfigs(tree: Tree, project: string): void {
  const projectConfig = readProjectConfiguration(tree, project);

  updateJson(
    tree,
    joinPathFragments(projectConfig.root, 'tsconfig.json'),
    (json) => {
      return {
        ...json,
        references: [
          ...(json.references || []),
          {
            path: './tsconfig.spec.json',
          },
        ],
      };
    }
  );

  let extraFiles: string[] = [];
  if (
    projectConfig.projectType == 'application' &&
    projectConfig.targets.build?.options?.polyfills &&
    typeof projectConfig.targets.build.options.polyfills === 'string'
  ) {
    let polyfillsPath = projectConfig.targets.build.options.polyfills;
    polyfillsPath = polyfillsPath.startsWith(projectConfig.root)
      ? polyfillsPath.replace(`${projectConfig.root}/`, '')
      : polyfillsPath;
    extraFiles = [polyfillsPath];
  }

  return updateJson(
    tree,
    joinPathFragments(projectConfig.root, 'tsconfig.spec.json'),
    (json) => {
      return {
        ...json,
        files: [...json.files, ...extraFiles],
      };
    }
  );
}
