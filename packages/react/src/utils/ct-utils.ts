import {
  createProjectGraphAsync,
  parseTargetString,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { getComponentNode } from './ast-utils';
import { type FoundTarget } from '@nx/cypress/src/utils/find-target-options';

let tsModule: typeof import('typescript');

const allowedFileExt = new RegExp(/\.[jt]sx?/);
const isSpecFile = new RegExp(/(spec|test)\./);

export async function addCTTargetWithBuildTarget(
  tree: Tree,
  options: {
    project: string;
    buildTarget: string;
    validExecutorNames: Set<string>;
  }
): Promise<FoundTarget> {
  let found: FoundTarget = { target: options.buildTarget, config: undefined };

  // Specifically undefined as a workaround for Remix to pass an empty string as the buildTarget
  if (options.buildTarget === undefined) {
    const { findBuildConfig } = await import(
      '@nx/cypress/src/utils/find-target-options'
    );
    found = await findBuildConfig(tree, {
      project: options.project,
      buildTarget: options.buildTarget,
      validExecutorNames: options.validExecutorNames,
    });

    assertValidConfig(found?.config);
  }

  const projectConfig = readProjectConfiguration(tree, options.project);
  projectConfig.targets['component-test'].options = {
    ...projectConfig.targets['component-test'].options,
    devServerTarget: found.target,
    skipServe: true,
  };
  updateProjectConfiguration(tree, options.project, projectConfig);

  return found;
}

function assertValidConfig(config: unknown) {
  if (!config) {
    throw new Error(
      'Unable to find a valid build configuration. Try passing in a target for an app. --build-target=<project>:<target>[:<configuration>]'
    );
  }
}

export async function getBundlerFromTarget(
  found: FoundTarget,
  tree: Tree
): Promise<'vite' | 'webpack'> {
  if (found.target && found.config?.executor) {
    return found.config.executor === '@nrwl/vite:build' ||
      found.config.executor === '@nx/vite:build'
      ? 'vite'
      : 'webpack';
  }

  const { target, project } = parseTargetString(
    found.target,
    await createProjectGraphAsync()
  );
  const projectConfig = readProjectConfiguration(tree, project);
  const executor = projectConfig?.targets?.[target]?.executor;
  return executor === '@nrwl/vite:build' || executor === '@nx/vite:build'
    ? 'vite'
    : 'webpack';
}

export function isComponent(tree: Tree, filePath: string): boolean {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  if (isSpecFile.test(filePath) || !allowedFileExt.test(filePath)) {
    return false;
  }

  const content = tree.read(filePath, 'utf-8');
  const sourceFile = tsModule.createSourceFile(
    filePath,
    content,
    tsModule.ScriptTarget.Latest,
    true
  );

  const cmpDeclaration = getComponentNode(sourceFile);
  return !!cmpDeclaration;
}
