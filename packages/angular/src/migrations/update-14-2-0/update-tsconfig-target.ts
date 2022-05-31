import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nrwl/devkit';
import {
  createProjectGraphAsync,
  formatFiles,
  joinPathFragments,
  logger,
  readProjectConfiguration,
  readTsConfigJson,
  updateTsConfigJson,
} from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { dirname } from 'path';
import type { StringLiteral } from 'typescript';

const jestExecutor = '@nrwl/jest:jest';
const executors = [
  '@angular-devkit/build-angular:browser',
  '@angular-devkit/build-angular:karma',
  '@angular-devkit/build-angular:ng-packagr',
  '@nrwl/angular:webpack-browser',
  '@nrwl/angular:delegate-build',
  '@nrwl/angular:ng-packagr-lite',
  '@nrwl/angular:package',
];
const skipTargets = ['es2020', 'es2021', 'es2022', 'esnext'];

export default async function (tree: Tree) {
  const tsConfigPaths = await collectTsConfigPaths(tree);

  for (const tsConfigPath of tsConfigPaths) {
    updateTsConfigJson(tree, tsConfigPath, (json) => {
      if (
        !json.compilerOptions?.target ||
        (json.compilerOptions?.target &&
          !skipTargets.includes(json.compilerOptions.target.toLowerCase()))
      ) {
        json.compilerOptions ??= {};
        json.compilerOptions.target = 'es2020';
      }
      return json;
    });
  }

  await formatFiles(tree);
}

async function collectTsConfigPaths(tree: Tree): Promise<string[]> {
  const uniqueTsConfigs = new Set([]);

  const projectGraph = await createProjectGraphAsync();
  const angularProjects = Object.entries(projectGraph.dependencies)
    .filter(([, dep]) =>
      dep.some(({ target }) => target === 'npm:@angular/core')
    )
    .map(([projectName]) => ({
      projectName,
      project: readProjectConfiguration(tree, projectName),
    }));

  for (const { projectName, project } of angularProjects) {
    const rootTsConfigPath = joinPathFragments(project.root, 'tsconfig.json');
    if (tree.exists(rootTsConfigPath)) {
      uniqueTsConfigs.add(rootTsConfigPath);

      const targetTsConfigPaths = getProjectTsConfigPaths(
        tree,
        project,
        projectName,
        false
      );
      targetTsConfigPaths.forEach((tsConfigPath) => {
        const tsConfig = readTsConfigJson(tree, tsConfigPath);
        if (tsConfig.compilerOptions?.target) {
          uniqueTsConfigs.add(tsConfigPath);
        }
      });

      continue;
    }

    const tsConfigPaths = getProjectTsConfigPaths(tree, project, projectName);
    for (const tsConfigPath of tsConfigPaths) {
      uniqueTsConfigs.add(tsConfigPath);
    }
  }

  return Array.from(uniqueTsConfigs);
}

function getProjectTsConfigPaths(
  tree: Tree,
  project: ProjectConfiguration,
  projectName: string,
  shouldWarn: boolean = true
): string[] {
  const tsConfigPaths = new Set<string>();

  for (const [targetName, target] of Object.entries(project.targets || {})) {
    if (executors.includes(target.executor)) {
      const tsConfigPathsFromTarget = getPathValuesFromTarget(
        target,
        'tsConfig'
      );
      tsConfigPathsFromTarget.forEach((tsConfigPath) => {
        if (tree.exists(tsConfigPath)) {
          tsConfigPaths.add(tsConfigPath);
        } else if (shouldWarn) {
          logger.warn(
            `The "${tsConfigPath}" file specified in the "${targetName}" target of the "${projectName}" project could not be found. ` +
              'Skipping setting the target to ES2020.'
          );
        }
      });
    } else if (target.executor === jestExecutor) {
      const tsConfigPathsFromJestTarget = getTsConfigPathsFromJestTarget(
        tree,
        target,
        targetName,
        projectName,
        shouldWarn
      );
      tsConfigPathsFromJestTarget.forEach((tsConfigPath) => {
        tsConfigPaths.add(tsConfigPath);
      });
    } else if (shouldWarn) {
      logger.warn(
        `The "${targetName}" target of the "${projectName}" project is using an executor not supported by the migration. ` +
          'Skipping setting the TS target to ES2020 for the project.'
      );
    }
  }

  return Array.from(tsConfigPaths);
}

function getTsConfigPathsFromJestTarget(
  tree: Tree,
  target: TargetConfiguration,
  targetName: string,
  projectName: string,
  shouldWarn: boolean
): string[] {
  const tsConfigPaths: string[] = [];

  const jestConfigPaths = getPathValuesFromTarget(target, 'jestConfig');
  if (!jestConfigPaths.length && shouldWarn) {
    logger.warn(
      `The "${targetName}" target of the "${projectName}" project is using the "${jestExecutor}" executor but no "jestConfig" property was specified. ` +
        'Skipping setting the TS compilation target to ES2020 for the project.'
    );
  }

  for (const jestConfigPath of jestConfigPaths) {
    const tsConfigPath = getTsConfigFromJestConfig(
      tree,
      jestConfigPath,
      targetName,
      projectName,
      shouldWarn
    );
    if (tsConfigPath) {
      tsConfigPaths.push(tsConfigPath);
    }
  }

  return tsConfigPaths;
}

function getTsConfigFromJestConfig(
  tree: Tree,
  jestConfigPath: string,
  targetName: string,
  projectName: string,
  shouldWarn: boolean
): string {
  if (!tree.exists(jestConfigPath)) {
    if (shouldWarn) {
      logger.warn(
        `The "${jestConfigPath}" file specified in the "${targetName}" target of the "${projectName}" project could not be found. ` +
          `The TS config file used by the target can't be determined. Skipping setting the target to ES2020.`
      );
    }
    return undefined;
  }

  const jestConfig = tree.read(jestConfigPath, 'utf-8');
  const jestConfigAst = tsquery.ast(jestConfig);
  const tsJestTsConfigStringLiteral = tsquery(
    jestConfigAst,
    'PropertyAssignment:has(Identifier[name=globals]) PropertyAssignment:has(StringLiteral[value=ts-jest]) PropertyAssignment Identifier[name=tsconfig] ~ StringLiteral',
    { visitAllChildren: true }
  )[0] as StringLiteral;

  if (!tsJestTsConfigStringLiteral) {
    if (shouldWarn) {
      logger.warn(
        `Couldn't find the "tsconfig" property for "ts-jest" in the Jest configuration file "${jestConfigPath}" specified in the ` +
          `"${targetName}" target of the "${projectName}" project. The TS config file used by the target can't be determined. ` +
          'Skipping setting the target to ES2020.'
      );
    }
    return undefined;
  }

  const tsJestTsConfigValue = tsJestTsConfigStringLiteral
    .getText()
    .replace(/['"]/g, '');
  const tsConfigPath = tsJestTsConfigValue.replace(
    '<rootDir>',
    dirname(jestConfigPath)
  );

  if (!tree.exists(tsConfigPath)) {
    if (shouldWarn) {
      logger.warn(
        `The "${tsJestTsConfigValue}" file specified in the Jest configuration file "${jestConfigPath}" of the "${targetName}" target ` +
          `of the "${projectName}" project could not be found. Skipping setting the target to ES2020.`
      );
    }
    return undefined;
  }

  return tsConfigPath;
}

function getPathValuesFromTarget(
  target: TargetConfiguration,
  option: string
): string[] {
  const values: string[] = [];

  if (target.options?.[option]) {
    values.push(target.options[option]);
  }

  Object.values(target.configurations ?? {}).forEach((options) => {
    if (options[option]) {
      values.push(options[option]);
    }
  });

  return values;
}
