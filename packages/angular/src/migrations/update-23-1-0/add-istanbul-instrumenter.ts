import {
  addDependenciesToPackageJson,
  getProjects,
  readNxJson,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { allTargetOptions } from '../../utils/targets';

// In v22 `istanbul-lib-instrument` is an optional peer dependency of
// `@angular/build` used to instrument code for Karma coverage. Optional peers
// are not installed automatically, so it must be added when Karma is in use.
// Inlined here (not in `versions.ts`) because no generator installs it; only
// this migration does. Mirrors Angular's `add-istanbul-instrumenter`.
const istanbulLibInstrumentVersion = '^6.0.3';

const karmaBuilders = [
  '@angular-devkit/build-angular:karma',
  '@angular/build:karma',
];
const unitTestBuilders = ['@angular/build:unit-test', '@nx/angular:unit-test'];

type UnitTestOptions = { runner?: string };

// A target uses Karma when its builder is a Karma builder, or it's a unit-test
// builder with `runner: karma` (in options or any configuration). `executors`
// holds the candidate executor ids: a target's own executor, or those a project
// `test` target inherits from an nx.json targetDefault (keyed by target name or
// by executor).
function usesKarma(
  executors: Array<string | undefined>,
  target: Pick<TargetConfiguration, 'options' | 'configurations'>
): boolean {
  if (executors.some((e) => karmaBuilders.includes(e))) {
    return true;
  }

  if (executors.some((e) => unitTestBuilders.includes(e))) {
    for (const [, options] of allTargetOptions(
      target as TargetConfiguration<UnitTestOptions>
    )) {
      if (options?.runner === 'karma') {
        return true;
      }
    }
  }

  return false;
}

export default async function (tree: Tree) {
  let needsInstrumenter = false;

  // project.json targets
  for (const [, project] of getProjects(tree)) {
    needsInstrumenter = Object.values(project.targets ?? {}).some((target) =>
      usesKarma([target.executor], target)
    );
    if (needsInstrumenter) {
      break;
    }
  }

  // nx.json targetDefaults: a project's empty `test` target can inherit a Karma
  // executor/runner from a default.
  if (!needsInstrumenter) {
    const targetDefaults = readNxJson(tree)?.targetDefaults;
    if (targetDefaults) {
      needsInstrumenter = Object.entries(targetDefaults).some(
        ([targetOrExecutor, config]) =>
          usesKarma([targetOrExecutor, config.executor], config)
      );
    }
  }

  if (!needsInstrumenter) {
    return;
  }

  return addDependenciesToPackageJson(
    tree,
    {},
    { 'istanbul-lib-instrument': istanbulLibInstrumentVersion },
    undefined,
    true
  );
}
