import { Task } from '../config/task-graph';
import { config as loadDotEnvFile } from 'dotenv';
import { expand } from 'dotenv-expand';
import { workspaceRoot } from '../utils/workspace-root';

export function getEnvVariablesForBatchProcess(
  skipNxCache: boolean,
  captureStderr: boolean
): NodeJS.ProcessEnv {
  return {
    // User Process Env Variables override Dotenv Variables
    ...process.env,
    // Nx Env Variables overrides everything
    ...getNxEnvVariablesForForkedProcess(
      process.env.FORCE_COLOR === undefined ? 'true' : process.env.FORCE_COLOR,
      skipNxCache,
      captureStderr
    ),
  };
}

export function getTaskSpecificEnv(task: Task) {
  // Unload any dot env files at the root of the workspace that were loaded on init of Nx.
  const taskEnv = unloadDotEnvFiles({ ...process.env });
  return process.env.NX_LOAD_DOT_ENV_FILES === 'true'
    ? loadDotEnvFilesForTask(task, taskEnv)
    : // If not loading dot env files, ensure env vars created by system are still loaded
      taskEnv;
}

export function getEnvVariablesForTask(
  task: Task,
  taskSpecificEnv: NodeJS.ProcessEnv,
  forceColor: string,
  skipNxCache: boolean,
  captureStderr: boolean,
  outputPath: string,
  streamOutput: boolean
) {
  const res = {
    // Start With Dotenv Variables
    ...taskSpecificEnv,
    // Nx Env Variables overrides everything
    ...getNxEnvVariablesForTask(
      task,
      forceColor,
      skipNxCache,
      captureStderr,
      outputPath,
      streamOutput
    ),
  };

  // we have to delete it because if we invoke Nx from within Nx, we need to reset those values
  if (!outputPath) {
    delete res.NX_TERMINAL_OUTPUT_PATH;
    delete res.NX_STREAM_OUTPUT;
    delete res.NX_PREFIX_OUTPUT;
  }
  // we don't reset NX_BASE or NX_HEAD because those are set by the user and should be preserved
  delete res.NX_SET_CLI;
  return res;
}

function getNxEnvVariablesForForkedProcess(
  forceColor: string,
  skipNxCache: boolean,
  captureStderr: boolean,
  outputPath?: string,
  streamOutput?: boolean
) {
  const env: NodeJS.ProcessEnv = {
    FORCE_COLOR: forceColor,
    NX_WORKSPACE_ROOT: workspaceRoot,
    NX_SKIP_NX_CACHE: skipNxCache ? 'true' : undefined,
  };

  if (outputPath) {
    env.NX_TERMINAL_OUTPUT_PATH = outputPath;
    if (captureStderr) {
      env.NX_TERMINAL_CAPTURE_STDERR = 'true';
    }
    if (streamOutput) {
      env.NX_STREAM_OUTPUT = 'true';
    }
  }
  return env;
}

function getNxEnvVariablesForTask(
  task: Task,
  forceColor: string,
  skipNxCache: boolean,
  captureStderr: boolean,
  outputPath: string,
  streamOutput: boolean
) {
  const env: NodeJS.ProcessEnv = {
    NX_TASK_TARGET_PROJECT: task.target.project,
    NX_TASK_TARGET_TARGET: task.target.target,
    NX_TASK_TARGET_CONFIGURATION: task.target.configuration ?? undefined,
    NX_TASK_HASH: task.hash,
    // used when Nx is invoked via Lerna
    LERNA_PACKAGE_NAME: task.target.project,
  };

  // TODO: remove this once we have a reasonable way to configure it
  if (task.target.target === 'test') {
    env.NX_TERMINAL_CAPTURE_STDERR = 'true';
  }

  return {
    ...getNxEnvVariablesForForkedProcess(
      forceColor,
      skipNxCache,
      captureStderr,
      outputPath,
      streamOutput
    ),
    ...env,
  };
}

/**
 * This function loads a .env file and expands the variables in it.
 * It is going to override existing environmentVariables.
 * @param filename
 * @param environmentVariables
 */
export function loadAndExpandDotEnvFile(
  filename: string,
  environmentVariables: NodeJS.ProcessEnv,
  override = false
) {
  const myEnv = loadDotEnvFile({
    path: filename,
    processEnv: environmentVariables,
    override,
  });
  return expand({
    ...myEnv,
    processEnv: environmentVariables,
  });
}

/**
 * This function unloads a .env file and removes the variables in it from the environmentVariables.
 * @param filename
 * @param environmentVariables
 */
export function unloadDotEnvFile(
  filename: string,
  environmentVariables: NodeJS.ProcessEnv,
  override = false
) {
  const parsedDotEnvFile: NodeJS.ProcessEnv = {};
  loadAndExpandDotEnvFile(filename, parsedDotEnvFile, override);
  Object.keys(parsedDotEnvFile).forEach((envVarKey) => {
    if (environmentVariables[envVarKey] === parsedDotEnvFile[envVarKey]) {
      delete environmentVariables[envVarKey];
    }
  });
}

function getEnvFilesForTask(task: Task): string[] {
  // Collect dot env files that may pertain to a task
  return [
    // Load DotEnv Files for a configuration in the project root
    ...(task.target.configuration
      ? [
          `${task.projectRoot}/.env.${task.target.target}.${task.target.configuration}.local`,
          `${task.projectRoot}/.env.${task.target.target}.${task.target.configuration}`,
          `${task.projectRoot}/.env.${task.target.configuration}.local`,
          `${task.projectRoot}/.env.${task.target.configuration}`,
          `${task.projectRoot}/.${task.target.target}.${task.target.configuration}.local.env`,
          `${task.projectRoot}/.${task.target.target}.${task.target.configuration}.env`,
          `${task.projectRoot}/.${task.target.configuration}.local.env`,
          `${task.projectRoot}/.${task.target.configuration}.env`,
        ]
      : []),

    // Load DotEnv Files for a target in the project root
    `${task.projectRoot}/.env.${task.target.target}.local`,
    `${task.projectRoot}/.env.${task.target.target}`,
    `${task.projectRoot}/.${task.target.target}.local.env`,
    `${task.projectRoot}/.${task.target.target}.env`,
    `${task.projectRoot}/.env.local`,
    `${task.projectRoot}/.local.env`,
    `${task.projectRoot}/.env`,

    // Load DotEnv Files for a configuration in the workspace root
    ...(task.target.configuration
      ? [
          `.env.${task.target.target}.${task.target.configuration}.local`,
          `.env.${task.target.target}.${task.target.configuration}`,
          `.env.${task.target.configuration}.local`,
          `.env.${task.target.configuration}`,
          `.${task.target.target}.${task.target.configuration}.local.env`,
          `.${task.target.target}.${task.target.configuration}.env`,
          `.${task.target.configuration}.local.env`,
          `.${task.target.configuration}.env`,
        ]
      : []),

    // Load DotEnv Files for a target in the workspace root
    `.env.${task.target.target}.local`,
    `.env.${task.target.target}`,
    `.${task.target.target}.local.env`,
    `.${task.target.target}.env`,

    // Load base DotEnv Files at workspace root
    `.local.env`,
    `.env.local`,
    `.env`,
  ];
}

function loadDotEnvFilesForTask(
  task: Task,
  environmentVariables: NodeJS.ProcessEnv
) {
  const dotEnvFiles = getEnvFilesForTask(task);
  for (const file of dotEnvFiles) {
    loadAndExpandDotEnvFile(file, environmentVariables);
  }
  return environmentVariables;
}

function unloadDotEnvFiles(environmentVariables: NodeJS.ProcessEnv) {
  for (const file of ['.env', '.local.env', '.env.local']) {
    unloadDotEnvFile(file, environmentVariables);
  }
  return environmentVariables;
}
