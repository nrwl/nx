import type { Config } from '@jest/types';
import {
  createProjectGraphAsync,
  formatFiles,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { migrateProjectExecutorsToPlugin } from '@nx/devkit/src/generators/plugin-migrations/executor-to-plugin-migrator';
import {
  processTargetOutputs,
  toProjectRelativePath,
} from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { readConfig } from 'jest-config';
import { join, normalize, posix } from 'node:path';
import { createNodesV2, type JestPluginOptions } from '../../plugins/plugin';
import { jestConfigExtensions } from '../../utils/config/config-file';

interface Schema {
  project?: string;
  skipFormat?: boolean;
}

export async function convertToInferred(tree: Tree, options: Schema) {
  const projectGraph = await createProjectGraphAsync();
  const migratedProjects =
    await migrateProjectExecutorsToPlugin<JestPluginOptions>(
      tree,
      projectGraph,
      '@nx/jest/plugin',
      createNodesV2,
      { targetName: 'test' },
      [
        {
          executors: ['@nx/jest:jest', '@nrwl/jest:jest'],
          postTargetTransformer,
          targetPluginOptionMapper: (targetName) => ({ targetName }),
        },
      ],
      options.project
    );

  if (migratedProjects.size === 0) {
    throw new Error('Could not find any targets to migrate.');
  }

  if (!options.skipFormat) {
    await formatFiles(tree);
  }
}

async function postTargetTransformer(
  target: TargetConfiguration,
  tree: Tree,
  projectDetails: { projectName: string; root: string },
  inferredTarget: TargetConfiguration
): Promise<TargetConfiguration> {
  const jestConfigPath = jestConfigExtensions
    .map((ext) => `jest.config.${ext}`)
    .find((configFileName) =>
      tree.exists(posix.join(projectDetails.root, configFileName))
    );

  if (target.options) {
    await updateOptionsObject(
      target.options,
      projectDetails.root,
      tree.root,
      jestConfigPath
    );
  }

  if (target.configurations) {
    for (const [configName, config] of Object.entries(target.configurations)) {
      await updateConfigurationObject(
        config,
        projectDetails.root,
        tree.root,
        jestConfigPath
      );

      if (!Object.keys(config).length) {
        delete target.configurations[configName];
      }
    }

    if (!Object.keys(target.configurations).length) {
      delete target.defaultConfiguration;
      delete target.configurations;
    }

    if (
      'defaultConfiguration' in target &&
      !target.configurations?.[target.defaultConfiguration]
    ) {
      delete target.defaultConfiguration;
    }
  }

  if (target.outputs) {
    processTargetOutputs(target, [], inferredTarget, {
      projectName: projectDetails.projectName,
      projectRoot: projectDetails.root,
    });
  }

  return target;
}

export default convertToInferred;

async function updateOptionsObject(
  targetOptions: any,
  projectRoot: string,
  workspaceRoot: string,
  defaultJestConfigPath: string | undefined
) {
  const jestConfigPath = targetOptions.jestConfig ?? defaultJestConfigPath;
  // inferred targets are only identified after known files that Jest would
  // pick up, so we can safely remove the config options
  delete targetOptions.jestConfig;
  delete targetOptions.config;

  await updateOptions(
    targetOptions,
    projectRoot,
    workspaceRoot,
    jestConfigPath
  );
}

async function updateConfigurationObject(
  targetOptions: any,
  projectRoot: string,
  workspaceRoot: string,
  defaultJestConfigPath: string | undefined
) {
  const jestConfigPath = targetOptions.jestConfig ?? defaultJestConfigPath;

  if (targetOptions.jestConfig) {
    targetOptions.config = toProjectRelativePath(
      targetOptions.jestConfig,
      projectRoot
    );
    delete targetOptions.jestConfig;
  } else if (targetOptions.config) {
    targetOptions.config = toProjectRelativePath(
      targetOptions.config,
      projectRoot
    );
  }

  await updateOptions(
    targetOptions,
    projectRoot,
    workspaceRoot,
    jestConfigPath
  );
}

async function updateOptions(
  targetOptions: any,
  projectRoot: string,
  workspaceRoot: string,
  jestConfigPath: string | undefined
) {
  // deprecated and unused
  delete targetOptions.tsConfig;

  if ('codeCoverage' in targetOptions) {
    targetOptions.coverage = targetOptions.codeCoverage;
    delete targetOptions.codeCoverage;
  }

  const testPathPatterns: string[] = [];
  if ('testFile' in targetOptions) {
    testPathPatterns.push(
      toProjectRelativeRegexPath(targetOptions.testFile, projectRoot)
    );
    delete targetOptions.testFile;
  }

  if ('testPathPattern' in targetOptions) {
    testPathPatterns.push(
      ...targetOptions.testPathPattern.map((pattern: string) =>
        toProjectRelativeRegexPath(pattern, projectRoot)
      )
    );
  }

  if (testPathPatterns.length > 1) {
    targetOptions.testPathPattern = `\"${testPathPatterns.join('|')}\"`;
  } else if (testPathPatterns.length === 1) {
    targetOptions.testPathPattern = testPathPatterns[0];
  }

  if ('testPathIgnorePatterns' in targetOptions) {
    if (targetOptions.testPathIgnorePatterns.length > 1) {
      targetOptions.testPathIgnorePatterns = `\"${targetOptions.testPathIgnorePatterns
        .map((pattern: string) =>
          toProjectRelativeRegexPath(pattern, projectRoot)
        )
        .join('|')}\"`;
    } else if (targetOptions.testPathIgnorePatterns.length === 1) {
      targetOptions.testPathIgnorePatterns = toProjectRelativeRegexPath(
        targetOptions.testPathIgnorePatterns[0],
        projectRoot
      );
    }
  }

  if ('testMatch' in targetOptions) {
    targetOptions.testMatch = targetOptions.testMatch
      .map(
        (pattern: string) =>
          `"${toProjectRelativeGlobPath(pattern, projectRoot)}"`
      )
      .join(' ');
  }

  if ('findRelatedTests' in targetOptions) {
    // the executor accepts a comma-separated string, while jest accepts a space-separated string
    const parsedSourceFiles = targetOptions.findRelatedTests
      .split(',')
      .map((s: string) => toProjectRelativePath(s.trim(), projectRoot))
      .join(' ');
    targetOptions.args = [`--findRelatedTests ${parsedSourceFiles}`];
    delete targetOptions.findRelatedTests;
  }

  if ('setupFile' in targetOptions) {
    const setupFiles = await processSetupFiles(
      targetOptions.setupFile,
      targetOptions.setupFilesAfterEnv,
      projectRoot,
      workspaceRoot,
      jestConfigPath
    );
    if (setupFiles.length > 1) {
      targetOptions.setupFilesAfterEnv = setupFiles
        .map((sf) => `"${sf}"`)
        .join(' ');
    } else if (setupFiles.length === 1) {
      targetOptions.setupFilesAfterEnv = setupFiles[0];
    } else {
      // if there are no setup files, it means they are already defined in the
      // jest config, so we can remove the option
      delete targetOptions.setupFilesAfterEnv;
    }
    delete targetOptions.setupFile;
  }

  if ('outputFile' in targetOptions) {
    // update the output file to be relative to the project root
    targetOptions.outputFile = toProjectRelativePath(
      targetOptions.outputFile,
      projectRoot
    );
  }
  if ('coverageDirectory' in targetOptions) {
    // update the coverage directory to be relative to the project root
    targetOptions.coverageDirectory = toProjectRelativePath(
      targetOptions.coverageDirectory,
      projectRoot
    );
  }
}

async function processSetupFiles(
  setupFile: string,
  setupFilesAfterEnv: string[] | undefined,
  projectRoot: string,
  workspaceRoot: string,
  jestConfigPath: string | undefined
): Promise<string[]> {
  // the jest executor merges the setupFile with the setupFilesAfterEnv, so
  // to keep the task working as before we resolve the setupFilesAfterEnv
  // from the options or the jest config and add the setupFile to it
  // https://github.com/nrwl/nx/blob/bdd3375256613340899f649eb800d22abcc9f507/packages/jest/src/executors/jest/jest.impl.ts#L107-L113
  const configSetupFilesAfterEnv: string[] = [];
  if (jestConfigPath) {
    const jestConfig = await readConfig(
      <Config.Argv>{ setupFilesAfterEnv },
      join(workspaceRoot, jestConfigPath)
    );
    if (jestConfig.projectConfig.setupFilesAfterEnv) {
      configSetupFilesAfterEnv.push(
        ...jestConfig.projectConfig.setupFilesAfterEnv.map((file: string) =>
          toProjectRelativePath(file, projectRoot)
        )
      );
    }
  }

  if (!configSetupFilesAfterEnv.length) {
    return [toProjectRelativePath(setupFile, projectRoot)];
  }

  if (
    isSetupFileInConfig(
      configSetupFilesAfterEnv,
      setupFile,
      projectRoot,
      workspaceRoot
    )
  ) {
    // the setupFile is already included in the setupFilesAfterEnv
    return [];
  }

  return [
    ...configSetupFilesAfterEnv,
    toProjectRelativePath(setupFile, projectRoot),
  ];
}

function isSetupFileInConfig(
  setupFilesAfterEnv: string[],
  setupFile: string,
  projectRoot: string,
  workspaceRoot: string
): boolean {
  const normalizePath = (f: string) =>
    f.startsWith('<rootDir>')
      ? posix.join(workspaceRoot, projectRoot, f.slice('<rootDir>'.length))
      : posix.join(workspaceRoot, projectRoot, f);

  const normalizedSetupFiles = new Set(setupFilesAfterEnv.map(normalizePath));

  return normalizedSetupFiles.has(
    normalizePath(toProjectRelativePath(setupFile, projectRoot))
  );
}

function toProjectRelativeRegexPath(path: string, projectRoot: string): string {
  if (projectRoot === '.') {
    // workspace and project root are the same, keep the path as is
    return path;
  }

  const normalizedRoot = normalize(projectRoot);
  if (
    new RegExp(`^(?:\\.[\\/\\\\])?${normalizedRoot}(?:[\\/\\\\])?$`).test(path)
  ) {
    // path includes everything inside project root
    return '.*';
  }

  const normalizedPath = normalize(path);
  const startWithProjectRootRegex = new RegExp(
    `^(?:\\.[\\/\\\\])?${normalizedRoot}[\\/\\\\]`
  );

  return startWithProjectRootRegex.test(normalizedPath)
    ? normalizedPath.replace(startWithProjectRootRegex, '')
    : path;
}

function toProjectRelativeGlobPath(path: string, projectRoot: string): string {
  if (projectRoot === '.') {
    // workspace and project root are the same, keep the path as is
    return path;
  }

  // globs use forward slashes, so we make sure to normalize the path
  const normalizedRoot = posix.normalize(projectRoot);

  return path
    .replace(new RegExp(`\/${normalizedRoot}\/`), '/')
    .replace(/\*\*\/\*\*/g, '**');
}
