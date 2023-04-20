import {
  applyChangesToString,
  ChangeType,
  generateFiles,
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
  output.log({
    title: 'Storybook 7 Migration Guide',
    bodyLines: [
      `You can run the following commands manually to upgrade your Storybook projects to Storybook 7:`,
      ``,
      `1. Call the Storybook upgrade script:`,
      `npx storybook@latest upgrade`,
      ``,
      `2. Call the Nx generator to prepare your files for migration:`,
      `nx g @nx/storybook:migrate-7 --onlyPrepare`,
      ``,
      `3. Call the Storybook automigrate scripts:`,
      `Run the following commands for each Storybook project:`,
      ...Object.entries(storybookProjects).map(
        ([_projectName, storybookProjectInfo]) => {
          return `npx storybook@latest automigrate --config-dir ${storybookProjectInfo.configDir} --renderer ${storybookProjectInfo.uiFramework}`;
        }
      ),
      ``,
      `4. Call the Nx generator to finish the migration:`,
      `nx g @nx/storybook:migrate-7 --afterMigration`,
    ],
  });
}

export function writeFile(file?: { path?: string; content?: string }) {
  if (file?.path && file?.content) {
    fs.writeFileSync(file.path, file.content);
  }
}

export function removePathResolvesFromNextConfig(
  tree: Tree,
  mainJsTsPath: string
): { path: string; content: string } | undefined {
  let mainJsTs = tree.read(mainJsTsPath, 'utf-8');
  const hasNextConfig = tsquery.query(
    mainJsTs,
    `PropertyAssignment:has(Identifier:has([name="nextConfigPath"]))`
  );

  const nextConfigPathAssignment = hasNextConfig?.find((propertyAssignment) => {
    return propertyAssignment.getText().startsWith('nextConfigPath');
  });

  if (!nextConfigPathAssignment) {
    // No nextConfigPath found, nothing to do
    return;
  }

  const pathResolve = tsquery.query(
    nextConfigPathAssignment,
    `CallExpression:has(PropertyAccessExpression:has([name="path"]):has([name="resolve"]))`
  )?.[0];

  if (pathResolve) {
    const getStringLiteral = tsquery.query(pathResolve, 'StringLiteral')?.[0];
    if (getStringLiteral) {
      mainJsTs = applyChangesToString(mainJsTs, [
        {
          type: ChangeType.Delete,
          start: pathResolve.getStart(),
          length: pathResolve.getText().length,
        },
        {
          type: ChangeType.Insert,
          index: pathResolve.getStart(),
          text: getStringLiteral.getText(),
        },
      ]);

      return {
        path: mainJsTsPath,
        content: mainJsTs,
      };
    }
  }
}

export function removeViteTsConfigPathsPlugin(
  tree: Tree,
  mainJsTsPath: string
) {
  let mainJsTs = tree.read(mainJsTsPath, 'utf-8');
  const { vitePluginVariableName, importExpression } =
    getViteTsConfigPathsNameAndImport(mainJsTs);

  const viteTsConfigPathsPluginParent = tsquery.query(
    mainJsTs,
    `CallExpression:has(Identifier[name="${vitePluginVariableName}"])`
  );
  const viteTsConfigPathsPlugin = viteTsConfigPathsPluginParent?.find(
    (callExpression) => {
      return callExpression.getText().startsWith(vitePluginVariableName);
    }
  );

  if (viteTsConfigPathsPlugin && importExpression) {
    mainJsTs = applyChangesToString(mainJsTs, [
      {
        type: ChangeType.Delete,
        start: viteTsConfigPathsPlugin.getStart(),
        length:
          mainJsTs[viteTsConfigPathsPlugin.getEnd()] === ','
            ? viteTsConfigPathsPlugin.getText().length + 1
            : viteTsConfigPathsPlugin.getText().length,
      },
      {
        type: ChangeType.Delete,
        start: importExpression.getStart(),
        length: importExpression.getText().length,
      },
    ]);
    tree.write(mainJsTsPath, mainJsTs);
    removePluginsArrayIfEmpty(tree, mainJsTsPath);
  }
}

function getViteTsConfigPathsNameAndImport(mainJsTs: string): {
  vitePluginVariableName: string;
  importExpression: ts.Node;
} {
  const requireVariableStatement = tsquery.query(
    mainJsTs,
    `VariableStatement:has(CallExpression:has(Identifier[name="require"]))`
  );

  let vitePluginVariableName: string;
  let importExpression: ts.Node;

  if (requireVariableStatement?.length) {
    importExpression = requireVariableStatement.find((statement) => {
      const requireCallExpression = tsquery.query(
        statement,
        'CallExpression:has(Identifier[name="require"])'
      );
      return requireCallExpression?.[0]
        ?.getText()
        ?.includes('vite-tsconfig-paths');
    });
    if (importExpression) {
      vitePluginVariableName = tsquery
        .query(importExpression, 'Identifier')?.[0]
        ?.getText();
    }
  } else {
    const importDeclarations = tsquery.query(mainJsTs, 'ImportDeclaration');
    importExpression = importDeclarations?.find((statement) => {
      const stringLiteral = tsquery.query(statement, 'StringLiteral');
      return stringLiteral?.[0]?.getText()?.includes('vite-tsconfig-paths');
    });
    if (importExpression) {
      vitePluginVariableName = tsquery
        .query(importExpression, 'Identifier')?.[0]
        ?.getText();
    }
  }

  return {
    vitePluginVariableName,
    importExpression,
  };
}

function removePluginsArrayIfEmpty(tree: Tree, mainJsTsPath: string) {
  let mainJsTs = tree.read(mainJsTsPath, 'utf-8');

  const viteFinalMethodDeclaration = tsquery.query(
    mainJsTs,
    `MethodDeclaration:has([name="viteFinal"])`
  )?.[0];
  if (!viteFinalMethodDeclaration) {
    return;
  }
  const pluginsPropertyAssignment = tsquery.query(
    viteFinalMethodDeclaration,
    `PropertyAssignment:has(Identifier:has([name="plugins"]))`
  )?.[0];
  if (!pluginsPropertyAssignment) {
    return;
  }
  const pluginsArrayLiteralExpression = tsquery.query(
    pluginsPropertyAssignment,
    `ArrayLiteralExpression`
  )?.[0];
  if (pluginsArrayLiteralExpression?.getText()?.replace(/\s/g, '') === '[]') {
    mainJsTs = applyChangesToString(mainJsTs, [
      {
        type: ChangeType.Delete,
        start: pluginsPropertyAssignment.getStart(),
        length:
          mainJsTs[pluginsPropertyAssignment.getEnd()] === ','
            ? pluginsPropertyAssignment.getText().length + 1
            : pluginsPropertyAssignment.getText().length,
      },
    ]);
    tree.write(mainJsTsPath, mainJsTs);
  }
}

export function addViteConfigFilePathInFrameworkOptions(
  tree: Tree,
  mainJsTsPath: string,
  viteConfigPath: string
) {
  let mainJsTs = tree.read(mainJsTsPath, 'utf-8');

  const viteFramework =
    tsquery.query(
      mainJsTs,
      `PropertyAssignment:has(Identifier:has([name="framework"])):has(StringLiteral:has([text="@storybook/react-vite"]))`
    )?.[0] ??
    tsquery.query(
      mainJsTs,
      `PropertyAssignment:has(Identifier:has([name="framework"])):has(StringLiteral:has([text="@storybook/web-components-vite"]))`
    )?.[0] ??
    tsquery.query(
      mainJsTs,
      `PropertyAssignment:has(Identifier:has([name="framework"])):has(StringLiteral:has([text="@storybook/svelte-vite"]))`
    )?.[0] ??
    tsquery.query(
      mainJsTs,
      `PropertyAssignment:has(Identifier:has([name="framework"])):has(StringLiteral:has([text="@storybook/vue-vite"]))`
    )?.[0] ??
    tsquery.query(
      mainJsTs,
      `PropertyAssignment:has(Identifier:has([name="framework"])):has(StringLiteral:has([text="@storybook/vue3-vite"]))`
    )?.[0];

  if (viteFramework) {
    const optionsPropertyAssignments = tsquery.query(
      viteFramework,
      `PropertyAssignment:has(Identifier:has([name="options"]))`
    );

    const frameworkOptionsPropertyAssignment = optionsPropertyAssignments?.find(
      (expression) => {
        return expression.getText().startsWith('options');
      }
    );
    if (frameworkOptionsPropertyAssignment) {
      const objectLiteralExpression = tsquery.query(
        frameworkOptionsPropertyAssignment,
        `ObjectLiteralExpression`
      )?.[0];

      mainJsTs = applyChangesToString(mainJsTs, [
        {
          type: ChangeType.Insert,
          index: objectLiteralExpression.getStart() + 1,
          text: `
                      builder: {
                        viteConfigPath: '${viteConfigPath}',
                      },
                      `,
        },
      ]);
      tree.write(mainJsTsPath, mainJsTs);
    } else {
      const objectLiteralExpression = tsquery.query(
        viteFramework,
        `ObjectLiteralExpression`
      )?.[0];
      if (!objectLiteralExpression) {
        return;
      }
      mainJsTs = applyChangesToString(mainJsTs, [
        {
          type: ChangeType.Insert,
          index: objectLiteralExpression.getStart() + 1,
          text: ` options: {
                      builder: {
                        viteConfigPath: '${viteConfigPath}',
                      },
                    },
                      `,
        },
      ]);
      tree.write(mainJsTsPath, mainJsTs);
    }
  }
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

export function removeTypecastFromMainTs(
  tree: Tree,
  mainTsPath: string
): { path: string; content: string } | undefined {
  let mainTs = tree.read(mainTsPath, 'utf-8');
  mainTs = mainTs.replace(/as StorybookConfig/g, '');
  return {
    path: mainTsPath,
    content: mainTs,
  };
}

export function removeUiFrameworkFromProjectJson(tree: Tree) {
  forEachExecutorOptions(
    tree,
    '@nx/storybook:build',
    (options, projectName, targetName) => {
      if (projectName && options?.['uiFramework']) {
        const projectConfiguration = readProjectConfiguration(
          tree,
          projectName
        );
        delete projectConfiguration.targets[targetName].options['uiFramework'];
        updateProjectConfiguration(tree, projectName, projectConfiguration);
      }
    }
  );

  forEachExecutorOptions(
    tree,
    '@nx/storybook:storybook',
    (options, projectName, targetName) => {
      if (projectName && options?.['uiFramework']) {
        const projectConfiguration = readProjectConfiguration(
          tree,
          projectName
        );
        delete projectConfiguration.targets[targetName].options['uiFramework'];
        updateProjectConfiguration(tree, projectName, projectConfiguration);
      }
    }
  );
}

export function changeCoreCommonImportToFramework(
  tree: Tree,
  mainTsPath: string
) {
  let mainTs = tree.read(mainTsPath, 'utf-8');

  const importDeclarations = tsquery.query(
    mainTs,
    'ImportDeclaration:has(ImportSpecifier:has([text="StorybookConfig"]))'
  )?.[0];
  if (!importDeclarations) {
    return;
  }
  const storybookConfigImportPackage = tsquery.query(
    importDeclarations,
    'StringLiteral'
  )?.[0];
  if (storybookConfigImportPackage?.getText() === `'@storybook/core-common'`) {
    const frameworkPropertyAssignment = tsquery.query(
      mainTs,
      `PropertyAssignment:has(Identifier:has([text="framework"]))`
    )?.[0];

    if (!frameworkPropertyAssignment) {
      return;
    }

    const propertyAssignments = tsquery.query(
      frameworkPropertyAssignment,
      `PropertyAssignment:has(Identifier:has([text="name"]))`
    );

    const namePropertyAssignment = propertyAssignments?.find((expression) => {
      return expression.getText().startsWith('name');
    });

    if (!namePropertyAssignment) {
      return;
    }

    const frameworkName = tsquery.query(
      namePropertyAssignment,
      `StringLiteral`
    )?.[0];

    if (frameworkName) {
      mainTs = applyChangesToString(mainTs, [
        {
          type: ChangeType.Delete,
          start: storybookConfigImportPackage.getStart(),
          length: storybookConfigImportPackage.getWidth(),
        },
        {
          type: ChangeType.Insert,
          index: storybookConfigImportPackage.getStart(),
          text: frameworkName.getText(),
        },
      ]);
      tree.write(mainTsPath, mainTs);
    }
  }
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

export function prepareFiles(
  tree: Tree,
  allStorybookProjects: {
    [key: string]: {
      configDir: string;
      uiFramework: string;
      viteConfigFilePath?: string;
    };
  }
) {
  output.log({
    title: `Preparing Storybook files.`,
    bodyLines: [
      `Nx will make some adjustments to the Storybook configuration files of your workspace`,
      `so that the Storybook automigration scripts can run successfully.`,
      `The adjustments are:`,
      ` - Remove the "as StorybookConfig" typecast from the main.ts files, if any`,
      ` - Remove the "path.resolve" calls from the Next.js Storybook configuration, if any`,
    ],
    color: 'blue',
  });
  Object.entries(allStorybookProjects).forEach(
    ([projectName, storybookProjectInfo]) => {
      const mainJsTsPath = tree.exists(
        `${storybookProjectInfo.configDir}/main.js`
      )
        ? `${storybookProjectInfo.configDir}/main.js`
        : tree.exists(`${storybookProjectInfo.configDir}/main.ts`)
        ? `${storybookProjectInfo.configDir}/main.ts`
        : undefined;

      if (!mainJsTsPath) {
        output.error({
          title: `Failed to prepare Storybook files for ${projectName}.`,
          bodyLines: [
            `Could not find main.js or main.ts in ${storybookProjectInfo.configDir}`,
            `Skipping project ${projectName}.`,
          ],
        });
      }

      if (mainJsTsPath.endsWith('.ts')) {
        writeFile(removeTypecastFromMainTs(tree, mainJsTsPath));
      }
      writeFile(removePathResolvesFromNextConfig(tree, mainJsTsPath));
    }
  );

  output.log({
    title: `Files prepared successfully!`,
    bodyLines: [`Nx prepared your files successfully.`],
    color: 'green',
  });
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

export function checkWebComponentsInstalled(packageJson): boolean {
  return (
    packageJson.dependencies['@storybook/web-components'] ||
    packageJson.devDependencies['@storybook/web-components-vite'] ||
    packageJson.dependencies['@storybook/web-components-vite'] ||
    packageJson.devDependencies['@storybook/web-components-webpack5'] ||
    packageJson.dependencies['@storybook/web-components-webpack5']
  );
}

export function afterMigration(
  tree: Tree,
  allStorybookProjects: {
    [key: string]: {
      configDir: string;
      uiFramework: string;
      viteConfigFilePath?: string;
    };
  }
) {
  Object.entries(allStorybookProjects).forEach(
    async ([_projectName, storybookProjectInfo]) => {
      const mainJsTsPath = tree.exists(
        `${storybookProjectInfo.configDir}/main.js`
      )
        ? `${storybookProjectInfo.configDir}/main.js`
        : tree.exists(`${storybookProjectInfo.configDir}/main.ts`)
        ? `${storybookProjectInfo.configDir}/main.ts`
        : undefined;

      removeViteTsConfigPathsPlugin(tree, mainJsTsPath);
      if (storybookProjectInfo.viteConfigFilePath) {
        addViteConfigFilePathInFrameworkOptions(
          tree,
          mainJsTsPath,
          storybookProjectInfo.viteConfigFilePath
        );
      }

      changeCoreCommonImportToFramework(tree, mainJsTsPath);
    }
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
      `🎉 Your Storybook configuration has been migrated to Storybook 7.0.0!`,
      `📖 You can see a summary of the tasks that were performed in the storybook-migration-summary.md file in the root of your workspace.`,
    ],
    color: 'green',
  });

  generateFiles(tree, joinPathFragments(__dirname, 'files'), '.', {
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
