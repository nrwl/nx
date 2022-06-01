import {
  addDependenciesToPackageJson,
  joinPathFragments,
  logger,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nrwl/devkit';

import type { Linter as ESLint } from 'eslint';

import { Schema as EsLintExecutorOptions } from '@nrwl/linter/src/executors/eslint/schema';

import { jsoncEslintParserVersion } from '../../utils/versions';
import { PluginLintChecksGeneratorSchema } from './schema';
import { NX_PREFIX } from 'nx/src/utils/logger';
import { PackageJson, readNxMigrateConfig } from 'nx/src/utils/package-json';

export default async function pluginLintCheckGenerator(
  host: Tree,
  options: PluginLintChecksGeneratorSchema
) {
  const project = readProjectConfiguration(host, options.projectName);
  const packageJson = readJson<PackageJson>(
    host,
    joinPathFragments(project.root, 'package.json')
  );

  // This rule is eslint **only**
  if (projectIsEsLintEnabled(project)) {
    updateRootEslintConfig(host);
    updateProjectEslintConfig(host, project, packageJson);
    updateProjectTarget(host, options, packageJson);

    // Project is setup for vscode
    if (host.exists('.vscode')) {
      setupVsCodeLintingForJsonFiles(host);
    }

    // Project contains migrations.json
    const migrationsPath = readNxMigrateConfig(packageJson).migrations;
    if (
      migrationsPath &&
      host.exists(joinPathFragments(project.root, migrationsPath))
    ) {
      addMigrationJsonChecks(host, options, packageJson);
    }
  } else {
    logger.error(
      `${NX_PREFIX} plugin lint checks can only be added to plugins which use eslint for linting`
    );
  }
  const installTask = addDependenciesToPackageJson(
    host,
    {},
    { 'jsonc-eslint-parser': jsoncEslintParserVersion }
  );
  return () => installTask;
}

export function addMigrationJsonChecks(
  host: Tree,
  options: PluginLintChecksGeneratorSchema,
  packageJson: PackageJson
) {
  const projectConfiguration = readProjectConfiguration(
    host,
    options.projectName
  );

  const [eslintTarget, eslintTargetConfiguration] =
    getEsLintOptions(projectConfiguration);

  const relativeMigrationsJsonPath =
    readNxMigrateConfig(packageJson).migrations;

  if (!relativeMigrationsJsonPath) {
    return;
  }

  const migrationsJsonPath = joinPathFragments(
    projectConfiguration.root,
    relativeMigrationsJsonPath
  );

  if (
    eslintTarget &&
    !eslintTargetConfiguration.options?.lintFilePatterns?.includes(
      migrationsJsonPath
    )
  ) {
    // Add to lintFilePatterns
    eslintTargetConfiguration.options.lintFilePatterns.push(migrationsJsonPath);
    updateProjectConfiguration(host, options.projectName, projectConfiguration);

    // Update project level eslintrc
    updateJson<ESLint.Config>(
      host,
      `${projectConfiguration.root}/.eslintrc.json`,
      (c) => {
        const override = c.overrides.find((o) =>
          Object.keys(o.rules ?? {})?.includes('@nrwl/nx/nx-plugin-checks')
        );
        if (
          Array.isArray(override?.files) &&
          !override.files.includes(relativeMigrationsJsonPath)
        ) {
          override.files.push(relativeMigrationsJsonPath);
        }
        return c;
      }
    );
  }
}

function updateProjectTarget(
  host: Tree,
  options: PluginLintChecksGeneratorSchema,
  packageJson: PackageJson
) {
  const project = readProjectConfiguration(host, options.projectName);
  if (!project.targets) {
    return;
  }

  for (const [target, configuration] of Object.entries(project.targets)) {
    if (configuration.executor === '@nrwl/linter:eslint') {
      const opts: EsLintExecutorOptions = configuration.options ?? {};
      opts.lintFilePatterns ??= [];

      if (packageJson.generators) {
        opts.lintFilePatterns.push(
          joinPathFragments(project.root, packageJson.generators)
        );
      }
      if (
        packageJson.schematics &&
        packageJson.schematics !== packageJson.generators
      ) {
        opts.lintFilePatterns.push(
          joinPathFragments(project.root, packageJson.schematics)
        );
      }
      if (packageJson.executors) {
        opts.lintFilePatterns.push(
          joinPathFragments(project.root, packageJson.executors)
        );
      }
      if (
        packageJson.builders &&
        packageJson.builders !== packageJson.executors
      ) {
        opts.lintFilePatterns.push(
          joinPathFragments(project.root, packageJson.builders)
        );
      }
      opts.lintFilePatterns.push(`${project.root}/package.json`);
      opts.lintFilePatterns = [...new Set(opts.lintFilePatterns)];
      project.targets[target].options = opts;
    }
  }
  updateProjectConfiguration(host, options.projectName, project);
}

function updateProjectEslintConfig(
  host: Tree,
  options: ProjectConfiguration,
  packageJson: PackageJson
) {
  // Update the project level lint configuration to specify
  // the plugin schema rule for generated files
  const eslintPath = `${options.root}/.eslintrc.json`;
  const eslintConfig = readJson<ESLint.Config>(host, eslintPath);
  eslintConfig.overrides ??= [];
  if (
    !eslintConfig.overrides.some((x) =>
      Object.keys(x.rules ?? {}).includes('@nrwl/nx/nx-plugin-checks')
    )
  ) {
    eslintConfig.overrides.push({
      files: [
        './package.json',
        packageJson.generators,
        packageJson.executors,
        packageJson.schematics,
        packageJson.builders,
      ].filter((f) => !!f),
      parser: 'jsonc-eslint-parser',
      rules: {
        '@nrwl/nx/nx-plugin-checks': 'error',
      },
    });
  }
  writeJson(host, eslintPath, eslintConfig);
}

// Update the root eslint to specify a parser for json files
// This is required, otherwise every json file that is not overriden
// will display false errors in the IDE
function updateRootEslintConfig(host: Tree) {
  const rootESLint = readJson<ESLint.Config>(host, '.eslintrc.json');
  rootESLint.overrides ??= [];
  if (!eslintConfigContainsJsonOverride(rootESLint)) {
    rootESLint.overrides.push({
      files: '*.json',
      parser: 'jsonc-eslint-parser',
      rules: {},
    });
    writeJson(host, '.eslintrc.json', rootESLint);
  }
}

function setupVsCodeLintingForJsonFiles(host: Tree) {
  let existing: Record<string, unknown> = {};
  if (host.exists('.vscode/settings.json')) {
    existing = readJson<Record<string, unknown>>(host, '.vscode/settings.json');
  } else {
    logger.info(
      `${NX_PREFIX} We've updated the vscode settings for this repository to ensure that plugin lint checks show up inside your IDE. This created .vscode/settings.json. To read more about this file, check vscode's documentation. It is frequently not commited, so other developers may need to add similar settings if they'd like to see the lint checks in the IDE rather than only during linting.`
    );
  }

  // setup eslint validation for json files
  const eslintValidate = (existing['eslint.validate'] as string[]) ?? [];
  if (!eslintValidate.includes('json')) {
    existing['eslint.validate'] = [...eslintValidate, 'json'];
  }
  writeJson(host, '.vscode/settings.json', existing);
}

function eslintConfigContainsJsonOverride(eslintConfig: ESLint.Config) {
  return eslintConfig.overrides.some((x) => {
    if (typeof x.files === 'string' && x.files.includes('.json')) {
      return true;
    }
    return Array.isArray(x.files) && x.files.some((f) => f.includes('.json'));
  });
}

function projectIsEsLintEnabled(project: ProjectConfiguration) {
  return !!getEsLintOptions(project);
}

export function getEsLintOptions(
  project: ProjectConfiguration
): [target: string, configuration: TargetConfiguration<EsLintExecutorOptions>] {
  return Object.entries(project.targets || {}).find(
    ([, x]) => x.executor === '@nrwl/linter:eslint'
  );
}
