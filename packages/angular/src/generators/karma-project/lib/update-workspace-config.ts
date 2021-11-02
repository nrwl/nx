import type { Tree } from '@nrwl/devkit';
import {
  joinPathFragments,
  readProjectConfiguration,
  updateProjectConfiguration,
} from '@nrwl/devkit';

export function updateWorkspaceConfig(tree: Tree, project: string): void {
  const projectConfig = readProjectConfiguration(tree, project);
  projectConfig.targets.test = {
    executor: '@angular-devkit/build-angular:karma',
    options: {
      main: joinPathFragments(projectConfig.sourceRoot, 'test.ts'),
      tsConfig: joinPathFragments(projectConfig.root, 'tsconfig.spec.json'),
      karmaConfig: joinPathFragments(projectConfig.root, 'karma.conf.js'),
    },
  };

  if (projectConfig.projectType === 'application') {
    projectConfig.targets.test.options = {
      ...projectConfig.targets.test.options,
      polyfills: joinPathFragments(projectConfig.sourceRoot, 'polyfills.ts'),
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
