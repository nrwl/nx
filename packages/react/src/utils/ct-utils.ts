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
import type { NxComponentTestingOptions } from '@nx/cypress/plugins/cypress-preset';

let tsModule: typeof import('typescript');

const allowedFileExt = new RegExp(/\.[jt]sx?/);
const isSpecFile = new RegExp(/(spec|test)\./);

export async function configureCypressCT(
  tree: Tree,
  options: {
    project: string;
    buildTarget: string;
    bundler: 'vite' | 'webpack';
    validExecutorNames: Set<string>;
  }
): Promise<FoundTarget> {
  let found: FoundTarget = { target: options.buildTarget, config: undefined };

  const projectConfig = readProjectConfiguration(tree, options.project);
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

  const { addDefaultCTConfig, getProjectCypressConfigPath } = await import(
    '@nx/cypress/src/utils/config'
  );

  const ctConfigOptions: NxComponentTestingOptions = {
    bundler: options.bundler ?? (await getActualBundler(tree, options, found)),
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
    ctConfigOptions
  );
  tree.write(
    cypressConfigFilePath,
    `import { nxComponentTestingPreset } from '@nx/react/plugins/component-testing';\n${updatedCyConfig}`
  );

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
