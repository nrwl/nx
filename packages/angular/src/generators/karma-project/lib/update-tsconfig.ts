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

  const extraFiles =
    projectConfig.projectType === 'library' ? [] : ['src/polyfills.ts'];
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
