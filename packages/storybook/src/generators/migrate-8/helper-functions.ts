import {
  applyChangesToString,
  ChangeType,
  generateFiles,
  getPackageManagerCommand,
  joinPathFragments,
  output,
  readProjectConfiguration,
  Tree,
  updateProjectConfiguration,
  workspaceRoot,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import ts = require('typescript');
import * as fs from 'fs';
import { fileExists } from 'nx/src/utils/fileutils';
import { readFileSync } from 'fs';
import { join } from 'path';

export function onlyShowGuide(storybookProjects: {
  [key: string]: {
    configDir: string;
    uiFramework: string;
    viteConfigFilePath?: string;
  };
}) {
  const pm = getPackageManagerCommand();

  output.log({
    title: 'Storybook 8 Migration Guide',
    bodyLines: [
      `You can run the following commands manually to upgrade your Storybook projects to Storybook 8:`,
      ``,
      `1. Call the Storybook upgrade script:`,
      `${pm.exec} storybook@latest upgrade`,
      ``,
      `2. Call the Storybook automigrate scripts:`,
      `Run the following commands for each Storybook project:`,
      ...Object.entries(storybookProjects).map(
        ([_projectName, storybookProjectInfo]) => {
          return `${pm.exec} storybook@latest automigrate --config-dir ${storybookProjectInfo.configDir}`;
        }
      ),
      ``,
    ],
  });
}

export function normalizeViteConfigFilePathWithTree(
  tree: Tree,
  projectRoot: string,
  configFile?: string
): string {
  return configFile && tree.exists(configFile)
    ? configFile
    : tree.exists(joinPathFragments(`${projectRoot}/vite.config.ts`))
    ? joinPathFragments(`${projectRoot}/vite.config.ts`)
    : tree.exists(joinPathFragments(`${projectRoot}/vite.config.js`))
    ? joinPathFragments(`${projectRoot}/vite.config.js`)
    : undefined;
}

export function getAllStorybookInfo(tree: Tree): {
  [key: string]: {
    configDir: string;
    uiFramework: string;
    viteConfigFilePath?: string;
  };
} {
  const allStorybookDirs = {};
  forEachExecutorOptions(
    tree,
    '@nx/storybook:build',
    (options, projectName) => {
      if (projectName && options?.['configDir']) {
        const projectConfiguration = readProjectConfiguration(
          tree,
          projectName
        );

        allStorybookDirs[projectName] = {
          configDir: options?.['configDir'],
          uiFramework: options?.['uiFramework'],
          viteConfigFilePath: normalizeViteConfigFilePathWithTree(
            tree,
            projectConfiguration.root,
            projectConfiguration.targets?.build?.options?.configFile
          ),
        };
      }
    }
  );

  forEachExecutorOptions(
    tree,
    '@storybook/angular:build-storybook',
    (options, projectName) => {
      if (projectName && options?.['configDir']) {
        allStorybookDirs[projectName] = {
          configDir: options?.['configDir'],
          uiFramework: '@storybook/angular',
        };
      }
    }
  );
  return allStorybookDirs;
}

export function handleMigrationResult(
  migrateResult: {
    successfulProjects: {};
    failedProjects: {};
  },
  allStorybookProjects: {
    [key: string]: {
      configDir: string;
      uiFramework: string;
      viteConfigFilePath?: string;
    };
  }
): { successfulProjects: {}; failedProjects: {} } {
  if (
    fileExists(join(workspaceRoot, 'migration-storybook.log')) &&
    Object.keys(migrateResult.successfulProjects)?.length
  ) {
    const sbLogFile = readFileSync(
      join(workspaceRoot, 'migration-storybook.log'),
      'utf-8'
    );
    Object.keys(migrateResult.successfulProjects).forEach((projectName) => {
      if (
        sbLogFile.includes(
          `The migration failed to update your ${allStorybookProjects[projectName].configDir}`
        )
      ) {
        migrateResult.failedProjects[projectName] =
          migrateResult.successfulProjects[projectName];
        delete migrateResult.successfulProjects[projectName];
      }
    });
  }

  if (
    Object.keys(allStorybookProjects)?.length ===
      Object.keys(migrateResult.successfulProjects)?.length ||
    Object.keys(migrateResult.failedProjects)?.length === 0
  ) {
    output.log({
      title: `Storybook configuration migrated.`,
      bodyLines: [
        `☑️ The automigrate command was successful.`,
        `All your projects were migrated successfully.`,
      ],
      color: 'green',
    });
  } else {
    if (Object.keys(migrateResult.failedProjects).length) {
      if (Object.keys(migrateResult.failedProjects).length) {
        output.log({
          title: `Storybook configuration migrated.`,
          bodyLines: [
            `☑️ The automigrate command was successful.`,
            `The following projects were migrated successfully:`,
            ...Object.keys(migrateResult.successfulProjects).map(
              (project) => `  - ${project}`
            ),
          ],
          color: 'green',
        });
      }

      output.log({
        title: `Failed migrations.`,
        bodyLines: [
          `There were some projects that were not migrated successfully.`,
          `⚠️ The following projects were not migrated successfully:`,
          ...Object.keys(migrateResult.failedProjects).map(
            (project) => `  - ${project}`
          ),
          `You can run the following commands to migrate them manually:`,
          ...Object.entries(migrateResult.failedProjects).map(
            ([_project, command]) => `- ${command}`
          ),
        ],
        color: 'red',
      });
    }
  }
  return migrateResult;
}

export function checkStorybookInstalled(packageJson): boolean {
  return (
    (packageJson.dependencies['@storybook/core-server'] ||
      packageJson.devDependencies['@storybook/core-server']) &&
    (packageJson.dependencies['@nx/storybook'] ||
      packageJson.devDependencies['@nx/storybook'] ||
      packageJson.dependencies['@nrwl/storybook'] ||
      packageJson.devDependencies['@nrwl/storybook'])
  );
}

export function logResult(
  tree: Tree,
  migrationSummary: {
    successfulProjects: { [key: string]: string };
    failedProjects: { [key: string]: string };
  }
) {
  output.log({
    title: `Migration complete!`,
    bodyLines: [
      `🎉 Your Storybook configuration has been migrated to Storybook ^8.0.0!`,
      `📖 You can see a summary of the tasks that were performed in the storybook-migration-summary.md file in the root of your workspace.`,
    ],
    color: 'green',
  });

  generateFiles(tree, join(__dirname, 'files'), '.', {
    tmpl: '',
    successfulProjects: Object.entries(
      migrationSummary?.successfulProjects
    )?.map(([_projectName, command]) => command),
    failedProjects: Object.entries(migrationSummary?.failedProjects)?.map(
      ([_projectName, command]) => command
    ),
    hasFailedProjects:
      Object.keys(migrationSummary?.failedProjects)?.length > 0,
    hasSuccessfulProjects:
      Object.keys(migrationSummary?.successfulProjects)?.length > 0,
  });
}
