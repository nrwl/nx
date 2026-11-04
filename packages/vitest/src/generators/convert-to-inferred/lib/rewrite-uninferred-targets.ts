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
  type TargetOptions,
  type UninferredTargetRewrite,
} from '@nx/devkit/internal';
import { posix } from 'node:path';

// Matches the config files @nx/vitest infers a project from
const inferredConfigName = /^(vite|vitest)\.config\.(js|ts|mjs|mts|cjs|cts)$/;

const isBoolean = (value: unknown) => typeof value === 'boolean';
const isPlainPathList = (value: unknown) =>
  Array.isArray(value) && value.every(isPlainPath);

/**
 * The only options a rewritten target may set. Each one keeps its meaning on
 * the Vitest CLI when run from the workspace root with --root.
 */
const acceptedOptions = new Map<string, (value: unknown) => boolean>([
  ['configFile', isPlainPath],
  ['testFiles', isPlainPathList],
  ['testFile', isPlainPathList],
  ['reportsDirectory', isPlainPath],
  ['mode', (value) => typeof value === 'string' && /^[\w.-]+$/.test(value)],
  ['coverage', isBoolean],
  ['passWithNoTests', isBoolean],
  ['silent', isBoolean],
  ['watch', isBoolean],
]);

/**
 * @nx/vitest infers a project's target only from a vite or vitest config in its
 * root, so a target running another config becomes an explicit command.
 */
export const vitestConfigRewrite: UninferredTargetRewrite = {
  executors: ['@nx/vitest:test', '@nrwl/vitest:test'],
  tool: 'Vitest',
  isInferred,
  toRunCommandsTarget,
};

function isInferred(
  tree: Tree,
  target: TargetConfiguration,
  project: ProjectConfiguration
) {
  const configFile = target.options?.configFile;
  if (configFile) {
    return isInferredConfig(posix.normalize(configFile), project.root);
  }
  return tree
    .children(project.root)
    .some((file) => inferredConfigName.test(file));
}

function isInferredConfig(configFile: string, projectRoot: string) {
  return (
    posix.dirname(configFile) === posix.normalize(projectRoot) &&
    inferredConfigName.test(posix.basename(configFile))
  );
}

// The executor loaded the config with root set to the project, and Vitest
// resolves --config against --root
function vitestCommand(configFile: string, projectRoot: string) {
  const config = posix.relative(projectRoot, posix.normalize(configFile));
  const relativeConfig = config.startsWith('.') ? config : `./${config}`;
  return `vitest run --root ${projectRoot} --config ${relativeConfig}`;
}

// The executor resolved reportsDirectory against the workspace root
function toVitestOptions(
  {
    configFile: _configFile,
    testFiles,
    testFile,
    reportsDirectory,
    ...flags
  }: TargetOptions,
  projectRoot: string
): TargetOptions {
  const filters = testFiles ?? testFile;
  return {
    ...flags,
    ...(reportsDirectory
      ? {
          'coverage.reportsDirectory': posix.relative(
            projectRoot,
            posix.normalize(reportsDirectory as string)
          ),
        }
      : {}),
    ...(filters ? { args: filters } : {}),
  };
}

/** `{options.reportsDirectory}` no longer exists, so outputs name the directory. */
function toOutputs(target: TargetConfiguration): string[] | undefined {
  const token = '{options.reportsDirectory}';
  if (!target.outputs?.some((output) => output.includes(token))) {
    return target.outputs;
  }
  const directories = new Set(
    [undefined, ...Object.keys(target.configurations ?? {})].map(
      (name) => optionsFor(target, name).reportsDirectory as string | undefined
    )
  );
  const [directory] = directories;
  if (directories.size > 1 || !directory) {
    throw new Error(
      'An output reads the "reportsDirectory" option, which differs between configurations or is unset.'
    );
  }
  const normalized = posix.normalize(directory);
  if (normalized.startsWith('..')) {
    throw new Error(
      `An output reads the "reportsDirectory" option, which points outside the workspace: ${directory}.`
    );
  }
  return target.outputs.map((output) =>
    output.replaceAll(token, `{workspaceRoot}/${normalized}`)
  );
}

function toRunCommandsTarget(
  target: TargetConfiguration,
  project: ProjectConfiguration
): TargetConfiguration {
  const { executor: _executor, options, configurations, ...rest } = target;
  for (const values of [options, ...Object.values(configurations ?? {})]) {
    assertAcceptedOptions(values, acceptedOptions);
  }
  if (!options?.configFile) {
    throw new Error(
      `The project has no config file Vitest can run: no configFile option and no vite.config or vitest.config in ${project.root}.`
    );
  }

  const outputs = toOutputs(target);
  const rewritten: TargetConfiguration = {
    executor: 'nx:run-commands',
    ...rest,
    ...(outputs ? { outputs } : {}),
    options: {
      command: vitestCommand(options.configFile, project.root),
      // The executor ran from where nx started, usually the workspace root.
      // Set explicitly, so an nx:run-commands default's cwd can't apply.
      cwd: '.',
      ...toVitestOptions(options, project.root),
    },
  };
  if (configurations) {
    rewritten.configurations = Object.fromEntries(
      Object.entries(configurations).map(([name, values]) => [
        name,
        {
          ...(values.configFile
            ? { command: vitestCommand(values.configFile, project.root) }
            : {}),
          ...toVitestOptions(values, project.root),
        },
      ])
    );
  }
  assertOutputOptionsKept(target, rewritten);
  return rewritten;
}
