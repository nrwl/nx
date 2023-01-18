import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateJson,
} from '@nrwl/devkit';
import { getInstalledAngularVersionInfo } from '../../utils/angular-version-utils';

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

  const installedAngularVersion = getInstalledAngularVersionInfo(tree);
  let extraFiles: string[] =
    installedAngularVersion.major === 14 ? ['src/test.ts'] : [];
  if (
    projectConfig.projectType == 'application' &&
    projectConfig.targets.build?.options?.polyfills &&
    typeof projectConfig.targets.build.options.polyfills === 'string'
  ) {
    let polyfillsPath = projectConfig.targets.build.options.polyfills;
    polyfillsPath = polyfillsPath.startsWith(projectConfig.root)
      ? polyfillsPath.replace(`${projectConfig.root}/`, '')
      : polyfillsPath;
    extraFiles = [...extraFiles, polyfillsPath];
  }

  if (!extraFiles.length) {
    return;
  }

  updateJson(
    tree,
    joinPathFragments(projectConfig.root, 'tsconfig.spec.json'),
    (json) => {
      return {
        ...json,
        files: [...(json.files ?? []), ...extraFiles],
      };
    }
  );
}
