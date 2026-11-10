import {
  formatFiles,
  joinPathFragments,
  logger,
  output,
  ProjectConfiguration,
  readJson,
  readProjectConfiguration,
  Tree,
  writeJson,
} from '@nx/devkit';

import { PluginLintChecksGeneratorSchema } from './schema';
import {
  addOverrideToLintConfig,
  findEslintFile,
  isEslintConfigSupported,
  lintConfigHasOverride,
  updateOverrideInLintConfig,
  useFlatConfig,
} from '@nx/eslint/internal';
import {
  NX_PREFIX,
  PackageJson,
  readNxMigrateConfig,
} from '@nx/devkit/internal';

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
  if (projectIsEsLintEnabled(host, project)) {
    updateRootEslintConfig(host);
    updateProjectEslintConfig(host, project, packageJson);

    // Project is setup for vscode
    if (host.exists('.vscode')) {
      setupVsCodeLintingForJsonFiles(host);
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

  if (!projectIsEsLintEnabled(host, projectConfiguration)) {
    return;
  }

  const relativeMigrationsJsonPath =
    readNxMigrateConfig(packageJson).migrations;

  if (!relativeMigrationsJsonPath) {
    return;
  }

  // Update project level eslintrc
  updateOverrideInLintConfig(
    host,
    projectConfiguration.root,
    (o) =>
      Object.keys(o.rules ?? {})?.includes('@nx/nx-plugin-checks') ||
      Object.keys(o.rules ?? {})?.includes('@nrwl/nx/nx-plugin-checks'),
    (o) => {
      const fileSet = new Set(Array.isArray(o.files) ? o.files : [o.files]);
      fileSet.add(relativeMigrationsJsonPath);
      return {
        ...o,
        files: formatFilesEntries(host, Array.from(fileSet)),
      };
    }
  );
}

function formatFilesEntries(tree: Tree, files: string[]): string[] {
  if (!useFlatConfig(tree)) {
    return files;
  }
  const filesAfter = files.map((f) => {
    const after = f.startsWith('./') ? f.replace('./', '**/') : f;
    return after;
  });
  return filesAfter;
}

function updateProjectEslintConfig(
  host: Tree,
  options: ProjectConfiguration,
  packageJson: PackageJson
) {
  if (isEslintConfigSupported(host, options.root)) {
    const lookup = (o) =>
      Object.keys(o.rules ?? {}).includes('@nx/nx-plugin-checks') ||
      Object.keys(o.rules ?? {}).includes('@nrwl/nx/nx-plugin-checks');

    const files = [
      './package.json',
      packageJson.generators,
      packageJson.executors,
      packageJson.schematics,
      packageJson.builders,
      readNxMigrateConfig(packageJson).migrations,
    ].filter((f) => !!f);

    const parser = useFlatConfig(host)
      ? { languageOptions: { parser: 'jsonc-eslint-parser' } }
      : { parser: 'jsonc-eslint-parser' };

    if (lintConfigHasOverride(host, options.root, lookup)) {
      // update it
      updateOverrideInLintConfig(host, options.root, lookup, (o) => ({
        ...o,
        files: formatFilesEntries(host, [
          ...new Set([
            ...(Array.isArray(o.files) ? o.files : [o.files]),
            ...files,
          ]),
        ]),
        ...parser,
        rules: {
          ...o.rules,
          '@nx/nx-plugin-checks': 'error',
        },
      }));
    } else {
      // add it
      addOverrideToLintConfig(host, options.root, {
        files: formatFilesEntries(host, files),
        ...parser,
        rules: {
          '@nx/nx-plugin-checks': 'error',
        },
      });
    }
  }
}

// Update the root eslint to specify a parser for json files
// This is required, otherwise every json file that is not overriden
// will display false errors in the IDE
function updateRootEslintConfig(host: Tree) {
  if (isEslintConfigSupported(host)) {
    if (
      !lintConfigHasOverride(
        host,
        '',
        (o) =>
          Array.isArray(o.files)
            ? o.files.some((f) => f.match(/\.json$/))
            : !!o.files?.match(/\.json$/),
        true
      )
    ) {
      addOverrideToLintConfig(
        host,
        '',
        {
          files: '*.json',
          parser: 'jsonc-eslint-parser',
          rules: {},
        },
        { checkBaseConfig: true }
      );
    }
  } else {
    output.note({
      title: 'Unable to update root eslint config.',
      bodyLines: [
        'We only automatically update the root eslint config if it is json or flat config.',
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

function projectIsEsLintEnabled(tree: Tree, project: ProjectConfiguration) {
  return !!findEslintFile(tree, project.root);
}
