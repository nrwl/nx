import {
  addDependenciesToPackageJson,
  getProjects,
  readJson,
  readNxJson,
  type Tree,
} from '@nx/devkit';
import { angularDevkitVersion } from '../../utils/versions';

// The `@nx/angular:application` and `@nx/angular:unit-test` executors import
// `@angular/build` directly to run the Angular builders, and any
// `@angular/build:*` executor is provided by that package; it is a required
// runtime dependency for these targets. Nothing declares it as a direct
// dependency, though: it has only ever been pulled in transitively via
// `@angular-devkit/build-angular`, which isn't reliable (it can be absent from
// node_modules, e.g. under Yarn Berry), so `require.resolve('@angular/build')`
// fails and the build breaks. Add it as a direct dependency when an executor
// needs it, at the version the application generator installs.
const angularBuildExecutors = [
  '@nx/angular:application',
  '@nx/angular:unit-test',
];

function usesAngularBuild(executors: Array<string | undefined>): boolean {
  return executors.some(
    (e) =>
      e != null &&
      (angularBuildExecutors.includes(e) || e.startsWith('@angular/build:'))
  );
}

export default async function (tree: Tree) {
  // Already a direct dependency -> nothing to add.
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  if (dependencies?.['@angular/build'] || devDependencies?.['@angular/build']) {
    return;
  }

  let needsAngularBuild = false;

  // project.json targets
  for (const [, project] of getProjects(tree)) {
    needsAngularBuild = Object.values(project.targets ?? {}).some((target) =>
      usesAngularBuild([target.executor])
    );
    if (needsAngularBuild) {
      break;
    }
  }

  // nx.json targetDefaults (keyed by target name or executor): a project's empty
  // target can inherit the executor from a default.
  if (!needsAngularBuild) {
    const targetDefaults = readNxJson(tree)?.targetDefaults;
    if (targetDefaults) {
      needsAngularBuild = Object.entries(targetDefaults).some(
        ([targetOrExecutor, config]) =>
          // Mirror `add-istanbul-instrumenter`: the filtered array value form is
          // out of scope; only plain object defaults carry an inheritable executor.
          !Array.isArray(config) &&
          usesAngularBuild([targetOrExecutor, config.executor])
      );
    }
  }

  if (!needsAngularBuild) {
    return;
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    { '@angular/build': angularDevkitVersion },
    undefined,
    true
  );
}
