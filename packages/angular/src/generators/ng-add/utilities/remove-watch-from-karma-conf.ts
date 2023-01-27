import type { Tree } from '@nrwl/devkit';
import { forEachExecutorOptions } from '@nrwl/workspace/src/utilities/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';

export function removeWatchFromKarmaConf(tree: Tree) {
  forEachExecutorOptions<
    import('@angular-devkit/build-angular').KarmaBuilderOptions
  >(tree, '@angular-devkit/build-angular:karma', (options) => {
    const karmaConfig = options?.karmaConfig;
    if (!karmaConfig) {
      return;
    }

    if (!tree.exists(karmaConfig)) {
      return;
    }

    const karmaConfFileContents = tree.read(karmaConfig, 'utf-8');
    const ast = tsquery.ast(karmaConfFileContents);

    const HAS_SINGLE_RUN_FALSE_SELECTOR = `PropertyAssignment:has(Identifier[name=singleRun]) > FalseKeyword`;
    const nodes = tsquery(ast, HAS_SINGLE_RUN_FALSE_SELECTOR, {
      visitAllChildren: true,
    });
    if (nodes.length === 0) {
      return;
    }

    const SINGLE_RUN_FALSE_SELECTOR = `PropertyAssignment:has(Identifier[name=singleRun])`;
    const node = tsquery(ast, SINGLE_RUN_FALSE_SELECTOR, {
      visitAllChildren: true,
    })[0];

    const newFileContents = `${karmaConfFileContents.slice(
      0,
      node.getStart()
    )}singleRun: true${karmaConfFileContents.slice(node.getEnd())}`;

    tree.write(karmaConfig, newFileContents);
  });
}
