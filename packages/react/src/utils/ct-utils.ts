import {
  createProjectGraphAsync,
  parseTargetString,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nx/devkit';
import { findPluginForConfigFile } from '@nx/devkit/internal';
import { ensureTypescript } from '@nx/js/internal';
import { getComponentNode } from './ast-utils';
import { type FoundTarget } from '@nx/cypress/internal';
import type { NxComponentTestingOptions } from '@nx/cypress/plugins/cypress-preset';

let tsModule: typeof import('typescript');

const allowedFileExt = new RegExp(/\.[jt]sx?/);
const isSpecFile = new RegExp(/(spec|test)\./);

// Resolved before the shared cypress generator runs, so the bundler reaches it.
export async function resolveCypressCTTarget(
  tree: Tree,
  options: {
    project: string;
    buildTarget: string;
    bundler: 'vite' | 'webpack';
    validExecutorNames: Set<string>;
  }
): Promise<{ found: FoundTarget; bundler: 'vite' | 'webpack' }> {
  let found: FoundTarget = { target: options.buildTarget, config: undefined };

  if (options.buildTarget !== '') {
    const graph = await createProjectGraphAsync();
    const parsed = options.buildTarget
      ? parseTargetString(options.buildTarget, graph)
      : undefined;
    const candidates = parsed
      ? [parsed.project]
      : [
          options.project,
          ...Object.keys(graph.dependencies).filter((name) =>
            graph.dependencies[name].some(
              (dep) => dep.target === options.project
            )
          ),
        ];
    for (const project of candidates) {
      const native = await findNativeBuild(tree, project, parsed?.target);
      if (native) {
        return {
          found: {
            target: options.buildTarget ?? native.target,
            config: { command: `${native.bundler} build` },
          },
          bundler: options.bundler ?? native.bundler,
        };
      }
    }
  }

  // Specifically undefined as a workaround for Remix to pass an empty string as the buildTarget
  if (options.buildTarget === undefined) {
    const {
      findBuildConfig,
    }: typeof import('@nx/cypress/internal') = require('@nx/cypress/internal');

    found = await findBuildConfig(tree, {
      project: options.project,
      buildTarget: options.buildTarget,
      validExecutorNames: options.validExecutorNames,
    });

    assertValidConfig(found?.config);
  } else if (options.buildTarget) {
    const projectGraph = await createProjectGraphAsync();
    const { project, target } = parseTargetString(
      options.buildTarget,
      projectGraph
    );
    const buildTargetProject = readProjectConfiguration(tree, project);
    const executor = buildTargetProject.targets?.[target]?.executor;
    if (!executor || !options.validExecutorNames.has(executor)) {
      throw new Error(
        `Cypress Component Testing is not currently supported for this project. Either 'executer' is not defined in '${target} target' of '${project} project.json' or executer present is not valid one. Valid ones are ${JSON.stringify(
          [...options.validExecutorNames]
        )}. Please check https://github.com/nrwl/nx/issues/21546 for more information.`
      );
    }
  }

  return {
    found,
    bundler: options.bundler ?? (await getActualBundler(tree, options, found)),
  };
}

export async function configureCypressCT(
  tree: Tree,
  options: {
    project: string;
    found: FoundTarget;
    bundler: 'vite' | 'webpack';
  }
): Promise<void> {
  const { found } = options;
  const projectConfig = readProjectConfiguration(tree, options.project);
  const {
    addDefaultCTConfig,
    getProjectCypressConfigPath,
    getInstalledCypressMajorVersion,
  }: typeof import('@nx/cypress/internal') = require('@nx/cypress/internal');

  const ctConfigOptions: NxComponentTestingOptions = {
    bundler: options.bundler,
  };
  if (
    projectConfig.targets?.['component-test']?.executor ===
    '@nx/cypress:cypress'
  ) {
    projectConfig.targets['component-test'].options = {
      ...projectConfig.targets['component-test'].options,
      devServerTarget: found.target,
      skipServe: true,
    };
    updateProjectConfiguration(tree, options.project, projectConfig);
  } else {
    ctConfigOptions.buildTarget = found.target;
  }

  const cypressConfigFilePath = getProjectCypressConfigPath(
    tree,
    projectConfig.root
  );
  const updatedCyConfig = await addDefaultCTConfig(
    tree.read(cypressConfigFilePath, 'utf-8'),
    ctConfigOptions,
    '@nx/react/plugins/component-testing',
    getInstalledCypressMajorVersion(tree)
  );
  tree.write(cypressConfigFilePath, updatedCyConfig);
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
    return found.config.executor === '@nx/vite:build' ? 'vite' : 'webpack';
  }

  const { target, project } = parseTargetString(
    found.target,
    await createProjectGraphAsync()
  );
  const projectConfig = readProjectConfiguration(tree, project);
  const native = await findNativeBuild(tree, project, target);
  if (native) return native.bundler;
  const executor = projectConfig?.targets?.[target]?.executor;
  return executor === '@nx/vite:build' ? 'vite' : 'webpack';
}

async function findNativeBuild(tree: Tree, project: string, target?: string) {
  const config = readProjectConfiguration(tree, project);
  if (
    target &&
    config.targets?.[target]?.executor &&
    config.targets[target].executor !== 'nx:run-commands'
  ) {
    return;
  }
  for (const bundler of ['vite', 'webpack'] as const) {
    for (const ext of ['ts', 'mts', 'cts', 'js', 'mjs', 'cjs']) {
      const path = joinPathFragments(config.root, `${bundler}.config.${ext}`);
      if (!tree.exists(path)) continue;
      const plugin = await findPluginForConfigFile(
        tree,
        `@nx/${bundler}/plugin`,
        path
      );
      if (!plugin) continue;
      const buildTarget =
        typeof plugin === 'string'
          ? 'build'
          : ((plugin.options as { buildTargetName?: string })
              ?.buildTargetName ?? 'build');
      if (target && target !== buildTarget) continue;
      return { target: `${project}:${buildTarget}`, bundler };
    }
  }
}

export async function getActualBundler(
  tree: Tree,
  options: { buildTarget?: string; bundler?: 'vite' | 'webpack' },
  found: FoundTarget
) {
  // Specifically undefined to allow Remix workaround of passing an empty string
  const actualBundler =
    options.buildTarget !== undefined && options.bundler
      ? options.bundler
      : await getBundlerFromTarget(found, tree);

  return actualBundler;
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
