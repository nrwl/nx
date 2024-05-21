import { dirname, join } from 'path';

import { readPluginPackageJson } from '../../project-graph/plugins';
import {
  CustomHasher,
  Executor,
  ExecutorConfig,
  ExecutorsJson,
  TaskGraphExecutor,
} from '../../config/misc-interfaces';
import { readJsonFile } from '../../utils/fileutils';
import {
  getImplementationFactory,
  resolveSchema,
} from '../../config/schema-utils';
import { getNxRequirePaths } from '../../utils/installation-directory';
import { ProjectConfiguration } from '../../config/workspace-json-project-json';

export function normalizeExecutorSchema(
  schema: Partial<ExecutorConfig['schema']>
): ExecutorConfig['schema'] {
  const version = (schema.version ??= 1);
  return {
    version,
    outputCapture:
      schema.outputCapture ?? version < 2 ? 'direct-nodejs' : 'pipe',
    properties:
      !schema.properties || typeof schema.properties !== 'object'
        ? {}
        : schema.properties,
    ...schema,
  };
}

function cacheKey(nodeModule: string, executor: string, root: string) {
  return `${root}:${nodeModule}:${executor}`;
}

const cachedExecutorInformation = {};

export function getExecutorInformation(
  nodeModule: string,
  executor: string,
  root: string,
  projects: Record<string, ProjectConfiguration>
): ExecutorConfig & { isNgCompat: boolean; isNxExecutor: boolean } {
  try {
    const key = cacheKey(nodeModule, executor, root);
    if (cachedExecutorInformation[key]) return cachedExecutorInformation[key];

    const { executorsFilePath, executorConfig, isNgCompat } = readExecutorJson(
      nodeModule,
      executor,
      root,
      projects
    );
    const executorsDir = dirname(executorsFilePath);
    const schemaPath = resolveSchema(executorConfig.schema, executorsDir);
    const schema = normalizeExecutorSchema(readJsonFile(schemaPath));

    const implementationFactory = getImplementationFactory<Executor>(
      executorConfig.implementation,
      executorsDir
    );

    const batchImplementationFactory = executorConfig.batchImplementation
      ? getImplementationFactory<TaskGraphExecutor>(
          executorConfig.batchImplementation,
          executorsDir
        )
      : null;

    const hasherFactory = executorConfig.hasher
      ? getImplementationFactory<CustomHasher>(
          executorConfig.hasher,
          executorsDir
        )
      : null;

    const res = {
      schema,
      implementationFactory,
      batchImplementationFactory,
      hasherFactory,
      isNgCompat,
      isNxExecutor: !isNgCompat,
    };

    cachedExecutorInformation[key] = res;
    return res;
  } catch (e) {
    throw new Error(
      `Unable to resolve ${nodeModule}:${executor}.\n${e.message}`
    );
  }
}

function readExecutorJson(
  nodeModule: string,
  executor: string,
  root: string,
  projects: Record<string, ProjectConfiguration>
): {
  executorsFilePath: string;
  executorConfig: {
    implementation: string;
    batchImplementation?: string;
    schema: string;
    hasher?: string;
  };
  isNgCompat: boolean;
} {
  const { json: packageJson, path: packageJsonPath } = readPluginPackageJson(
    nodeModule,
    projects,
    root
      ? [root, __dirname, process.cwd(), ...getNxRequirePaths()]
      : [__dirname, process.cwd(), ...getNxRequirePaths()]
  );
  const executorsFile = packageJson.executors ?? packageJson.builders;

  if (!executorsFile) {
    throw new Error(
      `The "${nodeModule}" package does not support Nx executors.`
    );
  }

  const executorsFilePath = require.resolve(
    join(dirname(packageJsonPath), executorsFile)
  );
  const executorsJson = readJsonFile<ExecutorsJson>(executorsFilePath);
  const executorConfig =
    executorsJson.executors?.[executor] || executorsJson.builders?.[executor];
  if (!executorConfig) {
    throw new Error(
      `Cannot find executor '${executor}' in ${executorsFilePath}.`
    );
  }
  if (typeof executorConfig === 'string') {
    // Angular CLI can have a builder pointing to another package:builder
    const [packageName, executorName] = executorConfig.split(':');
    return readExecutorJson(packageName, executorName, root, projects);
  }
  const isNgCompat = !executorsJson.executors?.[executor];
  return { executorsFilePath, executorConfig, isNgCompat };
}
