import {
  formatFiles,
  joinPathFragments,
  logger,
  output,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  TargetConfiguration,
  Tree,
  updateJson,
  updateProjectConfiguration,
  writeJson,
} from '@nx/devkit';

import type { Linter as ESLint } from 'eslint';

import type { Schema as EsLintExecutorOptions } from '@nx/linter/src/executors/eslint/schema';

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

  if (!options.skipFormat) {
    await formatFiles(host);
  }
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

  if (!projectIsEsLintEnabled(projectConfiguration)) {
    return;
  }

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
        const override = c.overrides.find(
          (o) =>
            Object.keys(o.rules ?? {})?.includes('@nx/nx-plugin-checks') ||
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
    if (
      configuration.executor === '@nx/linter:eslint' ||
      configuration.executor === '@nrwl/linter:eslint'
    ) {
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
  if (host.exists(eslintPath)) {
    const eslintConfig = readJson<ESLint.Config>(host, eslintPath);
    eslintConfig.overrides ??= [];
    let entry: ESLint.ConfigOverride<ESLint.RulesRecord> =
      eslintConfig.overrides.find(
        (x) =>
          Object.keys(x.rules ?? {}).includes('@nx/nx-plugin-checks') ||
          Object.keys(x.rules ?? {}).includes('@nrwl/nx/nx-plugin-checks')
      );
    const newentry = !entry;
    entry ??= { files: [] };
    entry.files = [
      ...new Set([
        ...(entry.files ?? []),
        ...[
          './package.json',
          packageJson.generators,
          packageJson.executors,
          packageJson.schematics,
          packageJson.builders,
        ].filter((f) => !!f),
      ]),
    ];
    entry.parser = 'jsonc-eslint-parser';
    entry.rules ??= {
      '@nx/nx-plugin-checks': 'error',
    };

    if (newentry) {
      eslintConfig.overrides.push(entry);
    }

    writeJson(host, eslintPath, eslintConfig);
  }
}

// Update the root eslint to specify a parser for json files
// This is required, otherwise every json file that is not overriden
// will display false errors in the IDE
function updateRootEslintConfig(host: Tree) {
  if (host.exists('.eslintrc.json')) {
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
  } else {
    output.note({
      title: 'Unable to update root eslint config.',
      bodyLines: [
        'We only automatically update the root eslint config if it is json.',
        'If you are using a different format, you will need to update it manually.',
        'You need to set the parser to jsonc-eslint-parser for json files.',
      ],
    });
  }
}

function setupVsCodeLintingForJsonFiles(host: Tree) {
  let existing: Record<string, unknown> = {};
  if (host.exists('.vscode/settings.json')) {
    existing = readJson<Record<string, unknown>>(host, '.vscode/settings.json');
  } else {
    logger.info(
      `${NX_PREFIX} We've updated the vscode settings for this repository to ensure that plugin lint checks show up inside your IDE. This created .vscode/settings.json. To read more about this file, check vscode's documentation. It is frequently not committed, so other developers may need to add similar settings if they'd like to see the lint checks in the IDE rather than only during linting.`
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
    ([, x]) =>
      x.executor === '@nx/linter:eslint' || x.executor === '@nrwl/linter:eslint'
  );
}
