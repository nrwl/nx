import {
  ExecutorContext,
  getPackageManagerCommand,
  readCachedProjectGraph,
} from '@nrwl/devkit';
import { DependentBuildableProjectNode } from '@nrwl/workspace/src/utilities/buildable-libs-utils';
import { readTsConfig } from '@nrwl/workspace/src/utilities/typescript';
import { NormalizedExecutorOptions } from './schema';

const tslibNodeName = 'npm:tslib';

function shouldAddTslibDependency(
  tsConfig: string,
  dependencies: DependentBuildableProjectNode[]
): boolean {
  if (dependencies.some((dep) => dep.name === tslibNodeName)) {
    return false;
  }

  const config = readTsConfig(tsConfig);
  return !!config.options.importHelpers;
}

export function addTslibDependencyIfNeeded(
  options: NormalizedExecutorOptions,
  context: ExecutorContext,
  dependencies: DependentBuildableProjectNode[]
): void {
  if (!shouldAddTslibDependency(options.tsConfig, dependencies)) {
    return;
  }

  const depGraph = readCachedProjectGraph();
  const tslibNode = depGraph.externalNodes[tslibNodeName];

  if (!tslibNode) {
    const pmc = getPackageManagerCommand();
    throw new Error(
      `"importHelpers" is enabled for ${context.targetName} but tslib is not installed. Use "${pmc.add} tslib" to install it.`
    );
  }

  const tslibDependency: DependentBuildableProjectNode = {
    name: tslibNodeName,
    outputs: [],
    node: tslibNode,
  };

  dependencies.push(tslibDependency);
}
