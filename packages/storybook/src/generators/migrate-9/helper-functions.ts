import {
  generateFiles,
  getPackageManagerCommand,
  output,
  Tree,
  workspaceRoot,
  visitNotIgnoredFiles,
  joinPathFragments,
  readJson,
  detectPackageManager,
} from '@nx/devkit';
import { fileExists } from 'nx/src/utils/fileutils';
import { readFileSync } from 'fs';
import { dirname, join } from 'path';

export function onlyShowGuide(storybookProjects: {
  [key: string]: {
    configDir: string;
  };
}) {
  output.log({
    title: 'Storybook Migration Guide',
    bodyLines: [
      `ℹ️ Nx has detected that you have Storybook installed in your workspace.`,
      `To migrate to Storybook 9, you need to run the following commands:`,
      ``,
      `1. Upgrade your Storybook packages to the latest version:`,
      `npx storybook@latest upgrade`,
      ``,
      `2. Run the automigrate command for each project that uses Storybook:`,
    ],
  });

  Object.entries(storybookProjects).forEach(
    ([_projectName, storybookProjectInfo]) => {
      output.log({
        title: '',
        bodyLines: [
          `npx storybook@latest automigrate --config-dir ${storybookProjectInfo.configDir}`,
        ],
      });
    }
  );
}

export function getAllStorybookInfo(tree: Tree) {
  const allStorybookProjects: {
    [key: string]: {
      configDir: string;
    };
  } = {};

  const storybookConfigPath = (path: string) => {
    const mainTsPath = join(path, 'main.ts');
    const mainJsPath = join(path, 'main.js');
    const mainCjsPath = join(path, 'main.cjs');
    const mainMjsPath = join(path, 'main.mjs');

    if (
      fileExists(mainTsPath) ||
      fileExists(mainJsPath) ||
      fileExists(mainCjsPath) ||
      fileExists(mainMjsPath)
    ) {
      const projectName = path
        .replace(workspaceRoot, '')
        .split('/')
        .filter((p) => p !== '.storybook' && p !== '')
        .join('-');

      if (projectName) {
        allStorybookProjects[projectName] = {
          configDir: path,
        };
      } else {
        allStorybookProjects['root'] = {
          configDir: path,
        };
      }
    }
  };

  visitNotIgnoredFiles(tree, '.', (path) => {
    if (path.includes('.storybook') && !path.includes('node_modules')) {
      storybookConfigPath(dirname(joinPathFragments(workspaceRoot, path)));
    }
  });

  return allStorybookProjects;
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
) {
  const packageManager = detectPackageManager();
  const pm = getPackageManagerCommand(packageManager);

  // Check if any projects failed to migrate
  if (Object.keys(migrateResult.failedProjects).length > 0) {
    output.log({
      title: 'Some projects failed to migrate',
      bodyLines: [
        `ℹ️ Some projects failed to migrate to Storybook 9.`,
        `You can try to run the migration manually for these projects.`,
      ],
    });

    Object.keys(migrateResult.failedProjects).forEach((projectName) => {
      output.log({
        title: `Failed to migrate ${projectName}`,
        bodyLines: [
          `Run the following command to migrate ${projectName} to Storybook 9:`,
          `${pm.dlx} ${
            packageManager === 'yarn' ? 'storybook' : 'storybook@latest'
          } automigrate --config-dir ${
            allStorybookProjects[projectName].configDir
          }`,
        ],
      });
    });
  }

  // Generate a migration summary file
  try {
    const migrationSummaryPath = join(workspaceRoot, 'storybook-migration.md');
    const successfulProjects = Object.entries(
      migrateResult.successfulProjects
    ).map(([project, _command]) => project);
    const failedProjects = Object.entries(migrateResult.failedProjects).map(
      ([project, _command]) => project
    );

    generateFiles(
      {
        sourceRoot: join(__dirname, 'files'),
        targetRoot: workspaceRoot,
        template: {
          hasSuccessfulProjects: successfulProjects.length > 0,
          hasFailedProjects: failedProjects.length > 0,
          successfulProjects: Object.values(migrateResult.successfulProjects),
          failedProjects: Object.values(migrateResult.failedProjects),
          tmpl: '',
        },
      },
      '',
      '',
      {
        'storybook-migration-summary.md__tmpl__': 'storybook-migration.md',
      }
    );

    output.log({
      title: 'Migration summary',
      bodyLines: [
        `ℹ️ A migration summary has been generated at ${migrationSummaryPath}`,
      ],
    });
  } catch (e) {
    output.error({
      title: 'Failed to generate migration summary',
      bodyLines: [`Error: ${e}`],
    });
  }

  return migrateResult;
}

export function checkStorybookInstalled(packageJson: any) {
  return Object.keys(packageJson.dependencies || {}).some((dep) =>
    dep.includes('@storybook')
  );
}

export function logResult(
  tree: Tree,
  migrationSummary: {
    successfulProjects: {};
    failedProjects: {};
  }
) {
  const successfulProjects = Object.entries(migrationSummary.successfulProjects);
  const failedProjects = Object.entries(migrationSummary.failedProjects);

  if (successfulProjects.length > 0) {
    output.log({
      title: 'Successfully migrated projects',
      bodyLines: [
        `✅ The following projects were successfully migrated to Storybook 9:`,
        ...successfulProjects.map(([_projectName, command]) => `- ${command}`),
      ],
    });
  }

  if (failedProjects.length > 0) {
    output.error({
      title: 'Failed to migrate projects',
      bodyLines: [
        `🚨 The following projects failed to migrate to Storybook 9:`,
        ...failedProjects.map(([_projectName, command]) => `- ${command}`),
      ],
    });
  }
}
