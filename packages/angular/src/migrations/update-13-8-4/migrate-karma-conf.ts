import type { Tree } from '@nrwl/devkit';
import {
  addDependenciesToPackageJson,
  joinPathFragments,
  readProjectConfiguration,
  formatFiles,
} from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
export default async function (tree: Tree) {
  const executorName = '@angular-devkit/build-angular:karma';

  forEachExecutorOptions(tree, executorName, ({ karmaConfig }, projectName) => {
    const project = readProjectConfiguration(tree, projectName);

    const pathToKarma = joinPathFragments(project.root, karmaConfig);
    if (!tree.exists(pathToKarma)) {
      return;
    }

    const karmaContents = tree.read(pathToKarma, 'utf-8');
    const updatedKarmaContents = karmaContents.replace(
      /coverageIstanbulReporter/g,
      'coverageReporter'
    );

    tree.write(pathToKarma, updatedKarmaContents);
  });

  const pathToRootKarmaConf = 'karma.conf.js';
  if (!tree.exists(pathToRootKarmaConf)) {
    return;
  }

  const rootKarmaContents = tree.read(pathToRootKarmaConf, 'utf-8');
  const updatedKarmaContents = rootKarmaContents
    .replace(/coverageIstanbulReporter/g, 'coverageReporter')
    .replace(/karma-coverage-istanbul-reporter/, 'karma-coverage')
    .replace(
      /reports: \['html', 'lcovonly'\]/,
      `subdir: '.',\nreporters: [{ type: 'html' }, { type: 'text-summary' }]`
    )
    .replace(/'\.\.\/\.\.\/coverage'/, `'./coverage'`);

  tree.write(pathToRootKarmaConf, updatedKarmaContents);

  const installPackages = addDependenciesToPackageJson(
    tree,
    {},
    {
      karma: '~6.3.0',
      'karma-coverage': '~2.2.0',
      'karma-jasmine-html-reporter': '~1.7.0',
      'jasmine-core': '~3.10.0',
    }
  );

  await formatFiles(tree);

  return installPackages;
}
