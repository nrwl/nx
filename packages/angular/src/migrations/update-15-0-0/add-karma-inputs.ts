import {
  formatFiles,
  readWorkspaceConfiguration,
  Tree,
  updateWorkspaceConfiguration,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';

export default async function (tree: Tree) {
  const workspaceConfiguration = readWorkspaceConfiguration(tree);

  const karmaTargets = getKarmaTargetNames(tree);
  const hasProductionFileset = !!workspaceConfiguration.namedInputs?.production;

  if (karmaTargets.size > 0 && hasProductionFileset) {
    const productionFileset = new Set(
      workspaceConfiguration.namedInputs.production
    );
    for (const exclusion of [
      '!{projectRoot}/**/*.spec.[jt]s',
      '!{projectRoot}/tsconfig.spec.json',
      '!{projectRoot}/karma.conf.js',
    ]) {
      productionFileset.add(exclusion);
    }
    workspaceConfiguration.namedInputs.production =
      Array.from(productionFileset);
  }

  for (const targetName of karmaTargets) {
    workspaceConfiguration.targetDefaults ??= {};
    const jestTargetDefaults = (workspaceConfiguration.targetDefaults[
      targetName
    ] ??= {});

    jestTargetDefaults.inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
      ...(tree.exists('karma.conf.js')
        ? ['{workspaceRoot}/karma.conf.js']
        : []),
    ];
  }

  updateWorkspaceConfiguration(tree, workspaceConfiguration);

  await formatFiles(tree);
}

function getKarmaTargetNames(tree: Tree) {
  const karmaTargetNames = new Set<string>();
  forEachExecutorOptions(
    tree,
    '@angular-devkit/build-angular:karma',
    (_, __, target) => {
      karmaTargetNames.add(target);
    }
  );
  return karmaTargetNames;
}
