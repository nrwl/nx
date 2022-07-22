import {
  DependentBuildableProjectNode,
  findMissingBuildDependencies,
} from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import * as chalk from 'chalk';
import { ExecutorContext, stripIndents } from '@nrwl/devkit';

export function assertDependentProjectsHaveBeenBuilt(
  dependencies: DependentBuildableProjectNode[],
  context: ExecutorContext
) {
  const missing = findMissingBuildDependencies(
    context.root,
    context.projectName,
    context.targetName,
    dependencies
  );
  if (missing.length > 0) {
    throw new Error(
      chalk.red(stripIndents`
      Some of the project ${
        context.projectName
      }'s dependencies have not been built yet.
      
      Please build these libraries first:
      ${missing.map((x) => ` - ${x.node.name}`).join('\n')}
    `)
    );
  }
}
