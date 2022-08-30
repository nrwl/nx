import { findBuildConfig } from '@nrwl/cypress/src/utils/find-target-options';
import {
  joinPathFragments,
  ProjectConfiguration,
  readProjectConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
} from '@nrwl/devkit';
import { CypressComponentConfigurationSchema } from '../schema';

export function updateTsConfig(
  tree: Tree,
  projectConfig: ProjectConfiguration
) {
  const tsConfigPath = joinPathFragments(
    projectConfig.root,
    projectConfig.projectType === 'library'
      ? 'tsconfig.lib.json'
      : 'tsconfig.app.json'
  );
  if (tree.exists(tsConfigPath)) {
    updateJson(tree, tsConfigPath, (json) => {
      const excluded = new Set([
        ...(json.exclude || []),
        'cypress/**/*',
        'cypress.config.ts',
        '**/*.cy.ts',
        '**/*.cy.js',
        '**/*.cy.tsx',
        '**/*.cy.jsx',
      ]);

      json.exclude = Array.from(excluded);
      return json;
    });
  }

  const projectBaseTsConfig = joinPathFragments(
    projectConfig.root,
    'tsconfig.json'
  );
  if (tree.exists(projectBaseTsConfig)) {
    updateJson(tree, projectBaseTsConfig, (json) => {
      if (json.references) {
        const hasCyTsConfig = json.references.some(
          (r) => r.path === './tsconfig.cy.json'
        );
        if (!hasCyTsConfig) {
          json.references.push({ path: './tsconfig.cy.json' });
        }
      } else {
        const excluded = new Set([
          ...(json.exclude || []),
          'cypress/**/*',
          'cypress.config.ts',
          '**/*.cy.ts',
          '**/*.cy.js',
          '**/*.cy.tsx',
          '**/*.cy.jsx',
        ]);

        json.exclude = Array.from(excluded);
      }
      return json;
    });
  }
}

export async function updateProjectConfig(
  tree: Tree,
  options: CypressComponentConfigurationSchema
) {
  const found = await findBuildConfig(tree, {
    project: options.project,
    buildTarget: options.buildTarget,
    validExecutorNames: new Set<string>(['@nrwl/web:webpack']),
  });

  assetValidConfig(found.config);

  const projectConfig = readProjectConfiguration(tree, options.project);
  projectConfig.targets['component-test'].options = {
    ...projectConfig.targets['component-test'].options,
    devServerTarget: found.target,
    skipServe: true,
  };
  updateProjectConfiguration(tree, options.project, projectConfig);
}

function assetValidConfig(config: unknown) {
  if (!config) {
    throw new Error(
      'Unable to find a valid build configuration. Try passing in a target for a React app. --build-target=<project>:<target>[:<configuration>]'
    );
  }
}
