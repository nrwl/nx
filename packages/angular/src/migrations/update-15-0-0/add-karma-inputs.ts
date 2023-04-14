import { formatFiles, readNxJson, Tree, updateNxJson } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';

export default async function (tree: Tree) {
  const nxJson = readNxJson(tree);

  const karmaTargets = getKarmaTargetNames(tree);
  const hasProductionFileset = !!nxJson.namedInputs?.production;

  if (karmaTargets.size > 0 && hasProductionFileset) {
    const productionFileset = new Set(nxJson.namedInputs.production);
    for (const exclusion of [
      '!{projectRoot}/**/*.spec.[jt]s',
      '!{projectRoot}/tsconfig.spec.json',
      '!{projectRoot}/karma.conf.js',
    ]) {
      productionFileset.add(exclusion);
    }
    nxJson.namedInputs.production = Array.from(productionFileset);
  }

  for (const targetName of karmaTargets) {
    nxJson.targetDefaults ??= {};
    const jestTargetDefaults = (nxJson.targetDefaults[targetName] ??= {});

    jestTargetDefaults.inputs ??= [
      'default',
      hasProductionFileset ? '^production' : '^default',
      ...(tree.exists('karma.conf.js')
        ? ['{workspaceRoot}/karma.conf.js']
        : []),
    ];
  }

  updateNxJson(tree, nxJson);

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
