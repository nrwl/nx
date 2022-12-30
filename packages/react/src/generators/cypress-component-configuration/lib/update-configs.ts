import {
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { CypressComponentConfigurationSchema } from '../schema';

export interface FoundTarget {
  config?: TargetConfiguration;
  target: string;
}

export async function updateProjectConfig(
  tree: Tree,
  options: CypressComponentConfigurationSchema
): Promise<FoundTarget> {
  const { findBuildConfig } = await import(
    '@nrwl/cypress/src/utils/find-target-options'
  );
  const found = await findBuildConfig(tree, {
    project: options.project,
    buildTarget: options.buildTarget,
    validExecutorNames: new Set<string>([
      '@nrwl/webpack:webpack',
      '@nrwl/vite:build',
    ]),
  });

  assetValidConfig(found?.config);

  const projectConfig = readProjectConfiguration(tree, options.project);
  projectConfig.targets['component-test'].options = {
    ...projectConfig.targets['component-test'].options,
    devServerTarget: found.target,
    skipServe: true,
  };
  updateProjectConfiguration(tree, options.project, projectConfig);

  return found;
}

function assetValidConfig(config: unknown) {
  if (!config) {
    throw new Error(
      'Unable to find a valid build configuration. Try passing in a target for a React app. --build-target=<project>:<target>[:<configuration>]'
    );
  }
}
