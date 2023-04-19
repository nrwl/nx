import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export function updateWorkspaceConfig(tree: Tree, project: string): void {
  const installedAngularVersionInfo = getInstalledAngularVersionInfo(tree);
  const projectConfig = readProjectConfiguration(tree, project);
  projectConfig.targets.test = {
    executor: '@angular-devkit/build-angular:karma',
    options: {
      ...(installedAngularVersionInfo.major === 14
        ? { main: joinPathFragments(projectConfig.sourceRoot, 'test.ts') }
        : {}),
      tsConfig: joinPathFragments(projectConfig.root, 'tsconfig.spec.json'),
      karmaConfig: joinPathFragments(projectConfig.root, 'karma.conf.js'),
      polyfills: ['zone.js', 'zone.js/testing'],
    },
  };

  if (projectConfig.projectType === 'application') {
    const polyfills = projectConfig.targets.build?.options?.polyfills;
    let polyfillsPath =
      polyfills && typeof polyfills === 'string' ? polyfills : undefined;

    projectConfig.targets.test.options = {
      ...projectConfig.targets.test.options,
      polyfills: polyfillsPath ?? projectConfig.targets.test.options.polyfills,
      styles: [],
      scripts: [],
      assets: [],
    };
  }

  if (
    projectConfig.targets.lint &&
    projectConfig.targets.lint.executor ===
      '@angular-devkit/build-angular:tslint'
  ) {
    projectConfig.targets.lint.options.tsConfig = [
      ...projectConfig.targets.lint.options.tsConfig,
      joinPathFragments(projectConfig.root, 'tsconfig.spec.json'),
    ];
  }

  updateProjectConfiguration(tree, project, projectConfig);
}
