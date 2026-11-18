import {
  createProjectGraphAsync,
  parseTargetString,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
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
  }
): Promise<{ found: FoundTarget; bundler: 'vite' | 'webpack' }> {
  const graph = await createProjectGraphAsync();
  const parsed = options.buildTarget
    ? parseTargetString(options.buildTarget, graph)
    : undefined;
  const candidates = parsed
    ? [parsed.project]
    : [
        options.project,
        ...Object.keys(graph.dependencies).filter((name) =>
          graph.dependencies[name].some((dep) => dep.target === options.project)
        ),
      ];
  let overridden:
    | { project: string; target: string; executor: string }
    | undefined;
  for (const project of candidates) {
    const native = await findNativeBuild(tree, project, parsed?.target);
    if (!native) continue;
    if (native.overridingExecutor) {
      overridden ??= {
        project,
        target: native.target,
        executor: native.overridingExecutor,
      };
      continue;
    }
    return {
      found: {
        target: options.buildTarget ?? native.target,
        config: { command: `${native.bundler} build` },
      },
      bundler: native.bundler,
    };
  }

  if (parsed) {
    const executor = readProjectConfiguration(tree, parsed.project).targets?.[
      parsed.target
    ]?.executor;
    throw notInferredBuildTargetError(
      options.buildTarget,
      parsed.project,
      executor
    );
  }
  if (overridden) {
    throw notInferredBuildTargetError(
      overridden.target,
      overridden.project,
      overridden.executor
    );
  }
  throw new Error(
    `Unable to find a build target inferred by @nx/vite/plugin or @nx/webpack/plugin for project "${options.project}" or the projects that depend on it. Pass one with --build-target=<project>:<target>[:<configuration>].`
  );
}

function notInferredBuildTargetError(
  buildTarget: string,
  project: string,
  executor: string | undefined
) {
  return new Error(
    `Cypress Component Testing needs a build target inferred by @nx/vite/plugin or @nx/webpack/plugin, and "${buildTarget}" is not one.${
      executor && executor !== 'nx:run-commands'
        ? ` It uses the "${executor}" executor. Convert it to an inferred target first, for example with "nx g @nx/workspace:infer-targets --project=${project}".`
        : ''
    }`
  );
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
    buildTarget: found.target,
  };

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

async function findNativeBuild(tree: Tree, project: string, target?: string) {
  const config = readProjectConfiguration(tree, project);
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
      // A project.json or package.json target on another executor replaces the
      // inferred one (nx.json targetDefaults can't change its executor).
      const executor = config.targets?.[buildTarget]?.executor;
      return {
        target: `${project}:${buildTarget}`,
        bundler,
        overridingExecutor:
          executor && executor !== 'nx:run-commands' ? executor : undefined,
      };
    }
  }
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
