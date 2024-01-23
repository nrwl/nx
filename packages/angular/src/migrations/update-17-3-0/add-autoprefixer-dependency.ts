import {
  addDependenciesToPackageJson,
  formatFiles,
  getProjects,
  type Tree,
} from '@nx/devkit';
import { getInstalledPackageVersion } from '../../generators/utils/version-utils';

export default async function (tree: Tree) {
  const autprefixerVersion = getInstalledPackageVersion(tree, 'autoprefixer');
  if (autprefixerVersion) {
    return;
  }

  const projects = getProjects(tree);
  for (const project of projects.values()) {
    if (project.projectType !== 'library') {
      continue;
    }

    for (const target of Object.values(project.targets ?? {})) {
      if (
        target.executor !== '@nx/angular:ng-packagr-lite' &&
        target.executor !== '@nx/angular:package'
      ) {
        continue;
      }

      addDependenciesToPackageJson(tree, {}, { autoprefixer: '^10.4.0' });
      await formatFiles(tree);

      return;
    }
  }
}
