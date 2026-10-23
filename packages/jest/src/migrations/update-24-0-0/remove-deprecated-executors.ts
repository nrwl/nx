import {
  getProjects,
  logger,
  readNxJson,
  readProjectConfiguration,
  updateProjectConfiguration,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import {
  mergeTargetConfigurations,
  migrateRemovedExecutors,
  readTargetDefaultsForTarget,
  resolveNxTokensInOptions,
  toProjectRelativePath,
} from '@nx/devkit/internal';
import { posix } from 'node:path';
import { isDeepStrictEqual } from 'node:util';
import { jestConfigExtensions } from '../../utils/config/config-file';

type ConvertToInferred =
  typeof import('../../generators/convert-to-inferred/convert-to-inferred');

type TargetsByProject = Map<string, Record<string, TargetConfiguration>>;

type Options = Record<string, unknown>;

const removedExecutors = ['@nx/jest:jest', '@nrwl/jest:jest'];

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

export default function update(tree: Tree) {
  return migrateRemovedExecutors(
    tree,
    removedExecutors,
    async (tree, options) => {
      const converter =
        require('../../generators/convert-to-inferred/convert-to-inferred') as ConvertToInferred;
      const unconverted = rewriteTargetsWithUndetectedConfig(tree);
      try {
        return await converter.convertToInferred(tree, options);
      } finally {
        restoreTargets(tree, unconverted);
      }
    }
  );
}

/**
 * @nx/jest/plugin infers a project's target only from `jest.config.<ext>` in
 * its root, so a target running another config becomes an explicit command.
 * A target that can't be rewritten is removed and returned, because the
 * converter would switch it to the project's `jest.config.<ext>`.
 */
function rewriteTargetsWithUndetectedConfig(tree: Tree): TargetsByProject {
  const targetDefaults = readNxJson(tree)?.targetDefaults;
  const unconvertedByProject: TargetsByProject = new Map();
  for (const [projectName, project] of getProjects(tree)) {
    const unconverted: Record<string, TargetConfiguration> = {};
    let changed = false;
    for (const [targetName, target] of Object.entries(project.targets ?? {})) {
      if (!removedExecutors.includes(target.executor)) {
        continue;
      }
      const readDefaults = (executor: string) =>
        readTargetDefaultsForTarget(targetName, targetDefaults, executor, {
          projectName,
          projectNode: { name: projectName, type: 'lib', data: project },
        });
      let runsUndetectedConfig = false;
      try {
        const executorDefaults = readDefaults(target.executor);
        const resolved = resolveTarget(
          target,
          executorDefaults,
          project,
          `${projectName}:${targetName}`
        );
        const jestConfig = resolved.options?.jestConfig;
        if (!jestConfig || isProjectRootJestConfig(jestConfig, project.root)) {
          continue;
        }
        runsUndetectedConfig = true;
        const rewritten = toRunCommandsTarget(resolved);
        assertDefaultsKeepTarget(
          rewritten,
          executorDefaults,
          readDefaults('nx:run-commands')
        );
        project.targets[targetName] = rewritten;
        changed = true;
      } catch (error) {
        logger.warn(
          `Could not rewrite target "${targetName}" in project "${projectName}" to run Jest with its config file: ${String(error)}`
        );
        if (runsUndetectedConfig) {
          unconverted[targetName] = target;
          delete project.targets[targetName];
          changed = true;
        }
      }
    }
    if (changed) {
      updateProjectConfiguration(tree, projectName, project);
    }
    if (Object.keys(unconverted).length) {
      unconvertedByProject.set(projectName, unconverted);
    }
  }
  return unconvertedByProject;
}

function restoreTargets(tree: Tree, targetsByProject: TargetsByProject) {
  for (const [projectName, targets] of targetsByProject) {
    // Read again to keep what the converter did to sibling targets
    const project = readProjectConfiguration(tree, projectName);
    project.targets = { ...project.targets, ...targets };
    updateProjectConfiguration(tree, projectName, project);
  }
}

/**
 * The target merged with the defaults the removed executor received, with Nx
 * tokens resolved.
 */
function resolveTarget(
  target: TargetConfiguration,
  defaults: Partial<TargetConfiguration> | null,
  project: ProjectConfiguration,
  key: string
): TargetConfiguration {
  const resolved = mergeTargetConfigurations(
    structuredClone(target),
    structuredClone(defaults ?? {})
  );
  if (resolved.options) {
    resolved.options = resolveNxTokensInOptions(resolved.options, project, key);
  }
  for (const name of Object.keys(resolved.configurations ?? {})) {
    resolved.configurations[name] = resolveNxTokensInOptions(
      resolved.configurations[name],
      project,
      `${key}:${name}`
    );
  }
  return resolved;
}

/**
 * Target defaults are matched by executor, so the rewritten target can get
 * entries the removed executor never did. They must not change it.
 */
function assertDefaultsKeepTarget(
  target: TargetConfiguration,
  executorDefaults: Partial<TargetConfiguration> | null,
  runCommandsDefaults: Partial<TargetConfiguration> | null
) {
  if (!runCommandsDefaults) {
    return;
  }
  // The executor got these entries too, and the target holds their values
  // translated for Jest
  if (isDeepStrictEqual(executorDefaults, runCommandsDefaults)) {
    return;
  }
  if (
    !isDeepStrictEqual(
      withDefaults(target, runCommandsDefaults),
      withDefaults(target, {})
    )
  ) {
    throw new Error(
      'The target defaults that apply to nx:run-commands targets would change it.'
    );
  }
}

// Resolves '...' spreads too, and drops the undefined values the merge leaves
function withDefaults(
  target: TargetConfiguration,
  defaults: Partial<TargetConfiguration>
) {
  return JSON.parse(
    JSON.stringify(
      mergeTargetConfigurations(
        structuredClone(target),
        structuredClone(defaults),
        undefined,
        undefined,
        undefined,
        false
      )
    )
  );
}

function isProjectRootJestConfig(jestConfig: string, projectRoot: string) {
  const path = posix.normalize(jestConfig);
  return jestConfigExtensions.some(
    (ext) => path === posix.join(projectRoot, `jest.config.${ext}`)
  );
}

// Relative, and left unchanged by sh, cmd.exe and nx:run-commands
function isPlainPath(value: unknown) {
  return typeof value === 'string' && /^[\w@+.-][\w@+./-]*$/.test(value);
}

function assertAcceptedOptions(options: Options) {
  for (const [name, value] of Object.entries(options)) {
    if (!acceptedOptions.get(name)?.(value)) {
      throw new Error(
        `The rewrite does not accept the "${name}" option set to ${JSON.stringify(value)}.`
      );
    }
  }
}

// jestConfig becomes the command, and the executor never passed tsConfig to Jest
function toJestOptions({
  jestConfig: _jestConfig,
  tsConfig: _tsConfig,
  codeCoverage,
  ...flags
}: Options): Options {
  return codeCoverage === undefined
    ? flags
    : { ...flags, coverage: codeCoverage };
}

// The leading ./ is what the move generator rewrites for a root project
function jestCommand(jestConfig: string) {
  return `jest --config ${toProjectRelativePath(posix.normalize(jestConfig), '.')}`;
}

function optionsFor(target: TargetConfiguration, configuration?: string) {
  return {
    ...target.options,
    ...(configuration ? target.configurations[configuration] : {}),
  };
}

function toRunCommandsTarget(target: TargetConfiguration): TargetConfiguration {
  const { executor: _executor, options, configurations, ...rest } = target;
  const configurationNames = Object.keys(configurations ?? {});
  for (const values of [options, ...Object.values(configurations ?? {})]) {
    assertAcceptedOptions(values);
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

  const outputOptions = [
    ...(rest.outputs ?? []).join(' ').matchAll(/\{options\.(\w+)/g),
  ].map(([, name]) => name);
  for (const name of [undefined, ...configurationNames]) {
    const before = optionsFor(target, name);
    const after = optionsFor(rewritten, name);
    const changed = outputOptions.find(
      (option) => !isDeepStrictEqual(before[option], after[option])
    );
    if (changed) {
      throw new Error(
        `An output reads the "${changed}" option, which the rewrite changes.`
      );
    }
  }
  return rewritten;
}
