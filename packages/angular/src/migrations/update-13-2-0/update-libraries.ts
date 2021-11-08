import type { Tree } from '@nrwl/devkit';
import { getProjects, joinPathFragments, updateJson } from '@nrwl/devkit';

export default async function (tree: Tree) {
  const LIBRARY_EXECUTORS = [
    '@nrwl/angular:ng-packagr-lite',
    '@nrwl/angular:package',
  ];
  const projects = getProjects(tree);

  const tsConfigFilesToUpdate = new Set<string>();
  const ngPackageFilesToUpdate = new Set<string>();
  for (const [projectName, project] of projects.entries()) {
    for (const [targetName, target] of Object.entries(project.targets)) {
      if (LIBRARY_EXECUTORS.includes(target.executor)) {
        // UPDATE THE TSCONFIG JSON
        const tsConfigPath = joinPathFragments(
          project.root,
          'tsconfig.lib.prod.json'
        );
        if (tree.exists(tsConfigPath)) {
          tsConfigFilesToUpdate.add(tsConfigPath);
        }

        const ngPackageFilePath = joinPathFragments(
          project.root,
          'ng-package.json'
        );
        if (tree.exists(ngPackageFilePath)) {
          ngPackageFilesToUpdate.add(ngPackageFilePath);
        }
      }
    }
  }

  for (const tsConfigPath of tsConfigFilesToUpdate) {
    updateJson(tree, tsConfigPath, (json) => {
      if (
        json.angularCompilerOptions &&
        'enableIvy' in json.angularCompilerOptions
      ) {
        json.angularCompilerOptions.enableIvy = undefined;
      }

      if (
        json.angularCompilerOptions &&
        !('compilationMode' in json.angularCompilerOptions)
      ) {
        json.angularCompilerOptions.compilationMode = 'partial';
      }

      return json;
    });
  }

  for (const ngPackagePath of ngPackageFilesToUpdate) {
    updateJson(tree, ngPackagePath, (json) => {
      if (json.lib && 'umdModuleIds' in json.lib) {
        json.lib.umdModuleIds = undefined;
      }
      if (json.lib && 'amdId' in json.lib) {
        json.lib.amdId = undefined;
      }
      if (json.lib && 'umdId' in json.lib) {
        json.lib.umdId = undefined;
      }
      return json;
    });
  }
}
