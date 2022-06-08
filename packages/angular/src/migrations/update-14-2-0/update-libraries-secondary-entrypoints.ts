import {
  formatFiles,
  getProjects,
  joinPathFragments,
  readJson,
  Tree,
  visitNotIgnoredFiles,
  writeJson,
} from '@nrwl/devkit';
import { basename, dirname } from 'path';

const libraryExecutors = [
  '@angular-devkit/build-angular:ng-packagr',
  '@nrwl/angular:ng-packagr-lite',
  '@nrwl/angular:package',
];

export default async function (tree: Tree) {
  const projects = getProjects(tree);

  for (const [, project] of projects) {
    if (
      !Object.values(project.targets ?? {}).some((target) =>
        libraryExecutors.includes(target.executor)
      )
    ) {
      continue;
    }

    visitNotIgnoredFiles(tree, project.root, (filePath) => {
      if (
        basename(filePath) !== 'package.json' ||
        filePath === joinPathFragments(project.root, 'package.json')
      ) {
        return;
      }

      const json = readJson(tree, filePath);
      if (json.ngPackage) {
        // Migrate ng-packagr config to an ng-packagr config file.
        const configFilePath = joinPathFragments(
          dirname(filePath),
          'ng-package.json'
        );
        writeJson(tree, configFilePath, json.ngPackage);
      }

      // Delete package.json as it is no longer needed in APF 14.
      tree.delete(filePath);
    });
  }

  await formatFiles(tree);
}
