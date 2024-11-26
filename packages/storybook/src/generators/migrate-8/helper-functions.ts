import {
  generateFiles,
  getPackageManagerCommand,
  output,
  readProjectConfiguration,
  Tree,
  workspaceRoot,
  visitNotIgnoredFiles,
  joinPathFragments,
  readJson,
} from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { fileExists } from 'nx/src/utils/fileutils';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

export function onlyShowGuide(storybookProjects: {
  [key: string]: {
    configDir: string;
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

export function getAllStorybookInfo(tree: Tree): {
  [key: string]: {
    configDir: string;
  };
} {
  const allStorybookDirs: { [key: string]: { configDir: string } } = {};

  visitNotIgnoredFiles(tree, '', (storybookConfigPath) => {
    if (
      !storybookConfigPath.endsWith('.storybook/main.ts') &&
      !storybookConfigPath.endsWith('.storybook/main.js')
    ) {
      return;
    }
    const storybookConfigDir = dirname(storybookConfigPath);

    let projectRoot = '';
    if (storybookConfigPath.includes('/.storybook')) {
      projectRoot = storybookConfigDir.replace('/.storybook', '');
    } else {
      projectRoot = storybookConfigDir.replace('.storybook', '');
    }

    if (projectRoot === '') {
      projectRoot = '.';
    }

    const packageOrProjectJson = [
      joinPathFragments(projectRoot, 'package.json'),
      joinPathFragments(projectRoot, 'project.json'),
    ].find((p) => tree.exists(p));
    if (!packageOrProjectJson) {
      return;
    }

    const projectName = readJson(tree, packageOrProjectJson)?.name;
    if (!projectName) {
      return;
    }
    allStorybookDirs[projectName] = {
      configDir: storybookConfigDir,
    };
  });

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
      packageJson.devDependencies['@nx/storybook'])
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
