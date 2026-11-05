import type {
  ProjectConfiguration,
  TargetConfiguration,
  Tree,
} from '@nx/devkit';
import {
  assertAcceptedOptions,
  assertOutputOptionsKept,
  isPlainPath,
  optionsFor,
  toProjectRelativePath,
  type TargetOptions,
  type UninferredTargetRewrite,
} from '@nx/devkit/internal';
import { posix } from 'node:path';
import {
  jestConfigExtensions,
  jestConfigFileNamePatterns,
} from '../../../utils/config/config-file';

const executors = ['@nx/jest:jest', '@nrwl/jest:jest'];

// The removed executor set this on every run; @nx/jest/plugin sets the same value
const tsNodeCompilerOptions = JSON.stringify({
  moduleResolution: 'node10',
  module: 'commonjs',
  customConditions: null,
});

const isBoolean = (value: unknown) => typeof value === 'boolean';
const isPositiveInteger = (value: unknown) =>
  Number.isSafeInteger(value) && (value as number) > 0;

/**
 * The only options a rewritten target may set. Generators wrote jestConfig,
 * tsConfig, passWithNoTests, ci and codeCoverage. Jest 29 and 30 read the other
 * flags from --name=value as the values the executor passed to runCLI.
 */
const acceptedOptions = new Map<string, (value: unknown) => boolean>([
  ['jestConfig', isPlainPath],
  ['tsConfig', (value) => typeof value === 'string'],
  ['codeCoverage', isBoolean],
  ['bail', isBoolean],
  ['ci', isBoolean],
  ['detectOpenHandles', isBoolean],
  ['forceExit', isBoolean],
  ['logHeapUsage', isBoolean],
  ['passWithNoTests', isBoolean],
  ['runInBand', isBoolean],
  ['silent', isBoolean],
  ['maxWorkers', isPositiveInteger],
  ['testTimeout', isPositiveInteger],
]);

/**
 * @nx/jest/plugin infers a project's target from `jest.config.<ext>` in its
 * root, or from another config in its root through `configToTargetName`. A
 * target running any other config becomes an explicit command.
 */
export const jestConfigRewrite: UninferredTargetRewrite = {
  executors,
  tool: 'Jest',
  isInferred: (
    tree: Tree,
    target: TargetConfiguration,
    project: ProjectConfiguration,
    targetName: string
  ) => {
    const jestConfig = target.options?.jestConfig;
    return (
      !jestConfig ||
      isProjectRootJestConfig(jestConfig, project.root) ||
      mappedJestConfigFileName(tree, target, project, targetName) !== undefined
    );
  },
  toRunCommandsTarget,
};

/**
 * The file name to map to the target in `configToTargetName`, or undefined
 * when the plugin cannot infer the target that way.
 */
export function mappedJestConfigFileName(
  tree: Tree,
  target: TargetConfiguration,
  project: ProjectConfiguration,
  targetName: string
): string | undefined {
  const jestConfig = target.options?.jestConfig;
  if (typeof jestConfig !== 'string') {
    return undefined;
  }
  const path = posix.normalize(jestConfig);
  const fileName = posix.basename(path);
  if (
    posix.dirname(path) !== posix.normalize(project.root) ||
    jestConfigFileNamePatterns.defaultName.test(fileName) ||
    !jestConfigFileNamePatterns.mappableName.test(fileName) ||
    !tree.exists(path)
  ) {
    return undefined;
  }
  // The inferred command names the config, so a configuration can't switch it
  const switchesConfig = Object.values(target.configurations ?? {}).some(
    ({ jestConfig: configured }) =>
      configured !== undefined && posix.normalize(configured) !== path
  );
  // The registration's default targetName infers `test` from jest.config.<ext>,
  // unless it is a workspace config the plugin skips
  const collidesWithDefault =
    targetName === 'test' &&
    jestConfigExtensions.some((ext) => {
      const path = posix.join(project.root, `jest.config.${ext}`);
      return (
        tree.exists(path) &&
        !tree.read(path, 'utf-8').includes('getJestProjectsAsync()')
      );
    });
  if (
    switchesConfig ||
    collidesWithDefault ||
    isClaimedByEarlierTarget(project, targetName, path)
  ) {
    return undefined;
  }
  return fileName;
}

// configToTargetName maps each config file to one target
function isClaimedByEarlierTarget(
  project: ProjectConfiguration,
  targetName: string,
  path: string
): boolean {
  for (const [name, target] of Object.entries(project.targets ?? {})) {
    if (name === targetName) {
      return false;
    }
    const jestConfig = target.options?.jestConfig;
    if (
      executors.includes(target.executor) &&
      typeof jestConfig === 'string' &&
      posix.normalize(
        jestConfig
          .replace('{workspaceRoot}/', '')
          .replace('{projectRoot}', project.root)
      ) === path
    ) {
      return true;
    }
  }
  return false;
}

function isProjectRootJestConfig(jestConfig: string, projectRoot: string) {
  const path = posix.normalize(jestConfig);
  return jestConfigExtensions.some(
    (ext) => path === posix.join(projectRoot, `jest.config.${ext}`)
  );
}

// jestConfig becomes the command, and the executor never passed tsConfig to Jest
function toJestOptions({
  jestConfig: _jestConfig,
  tsConfig: _tsConfig,
  codeCoverage,
  ...flags
}: TargetOptions): TargetOptions {
  return codeCoverage === undefined
    ? flags
    : { ...flags, coverage: codeCoverage };
}

// The leading ./ is what the move generator rewrites for a root project
function jestCommand(jestConfig: string) {
  return `jest --config ${toProjectRelativePath(posix.normalize(jestConfig), '.')}`;
}

function toRunCommandsTarget(target: TargetConfiguration): TargetConfiguration {
  const { executor: _executor, options, configurations, ...rest } = target;
  const configurationNames = Object.keys(configurations ?? {});
  for (const values of [options, ...Object.values(configurations ?? {})]) {
    assertAcceptedOptions(values, acceptedOptions);
  }
  for (const name of [undefined, ...configurationNames]) {
    const values = optionsFor(target, name);
    // runCLI accepted this pair, but Jest's CLI rejects it
    if (values.runInBand === true && 'maxWorkers' in values) {
      throw new Error('Jest rejects runInBand with maxWorkers on its CLI.');
    }
  }

  const rewritten: TargetConfiguration = {
    executor: 'nx:run-commands',
    ...rest,
    options: {
      command: jestCommand(options.jestConfig),
      // The executor ran from where nx started, usually the workspace root.
      // Set explicitly, so an nx:run-commands default's cwd can't apply.
      cwd: '.',
      env: { TS_NODE_COMPILER_OPTIONS: tsNodeCompilerOptions },
      ...toJestOptions(options),
    },
  };
  if (configurations) {
    rewritten.configurations = Object.fromEntries(
      configurationNames.map((name) => {
        const { jestConfig } = configurations[name];
        return [
          name,
          {
            ...(jestConfig ? { command: jestCommand(jestConfig) } : {}),
            ...toJestOptions(configurations[name]),
          },
        ];
      })
    );
  }
  assertOutputOptionsKept(target, rewritten);
  return rewritten;
}
