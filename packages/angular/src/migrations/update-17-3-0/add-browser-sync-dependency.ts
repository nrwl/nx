import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  type Tree,
} from '@nx/devkit';
import { getInstalledPackageVersion } from '../../generators/utils/version-utils';

export default async function (tree: Tree) {
  const browserSyncVersion = getInstalledPackageVersion(tree, 'browser-sync');
  if (browserSyncVersion) {
    return;
  }

  const projects = getProjects(tree);
  for (const project of projects.values()) {
    if (project.projectType !== 'application') {
      continue;
    }

    for (const target of Object.values(project.targets ?? {})) {
      if (
        target.executor !== '@angular-devkit/build-angular:ssr-dev-server' &&
        target.executor !== '@nx/angular:module-federation-dev-ssr'
      ) {
        continue;
      }

      addDependenciesToPackageJson(tree, {}, { 'browser-sync': '^3.0.0' });
      await formatFiles(tree);

      return;
    }
  }
}
