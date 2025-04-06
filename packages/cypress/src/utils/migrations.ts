import {
  getProjects,
  globAsync,
  type ProjectConfiguration,
  type TargetConfiguration,
  type Tree,
} from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { posix } from 'path';
import type {
  Expression,
  ObjectLiteralExpression,
  PropertyAssignment,
} from 'typescript';
import type { CypressExecutorOptions } from '../executors/cypress/cypress.impl';
import { CYPRESS_CONFIG_FILE_NAME_PATTERN } from './config';

let ts: typeof import('typescript');

export async function* cypressProjectConfigs(tree: Tree): AsyncGenerator<{
  projectName: string;
  projectConfig: ProjectConfiguration;
  cypressConfigPath: string;
}> {
  const projects = getProjects(tree);

  for (const [projectName, projectConfig] of projects) {
    const targetWithExecutor = Object.values(projectConfig.targets ?? {}).find(
      (target) => target.executor === '@nx/cypress:cypress'
    );
    if (targetWithExecutor) {
      for (const [, options] of allTargetOptions<CypressExecutorOptions>(
        targetWithExecutor
      )) {
        if (options.cypressConfig) {
          yield {
            projectName,
            projectConfig,
            cypressConfigPath: options.cypressConfig,
          };
        }
      }
    } else {
      // might be using the crystal plugin
      const result = await globAsync(tree, [
        posix.join(projectConfig.root, CYPRESS_CONFIG_FILE_NAME_PATTERN),
      ]);
      if (result.length > 0) {
        yield {
          projectName,
          projectConfig,
          cypressConfigPath: result[0],
        };
      }
    }
  }
}

export function getObjectProperty(
  config: ObjectLiteralExpression,
  name: string
): PropertyAssignment | undefined {
  ts ??= ensureTypescript();

  return config.properties.find(
    (p): p is PropertyAssignment =>
      ts.isPropertyAssignment(p) && p.name.getText() === name
  );
}

export function removeObjectProperty(
  config: ObjectLiteralExpression,
  property: PropertyAssignment
): ObjectLiteralExpression {
  ts ??= ensureTypescript();

  return ts.factory.updateObjectLiteralExpression(
    config,
    config.properties.filter((p) => p !== property)
  );
}

export function updateObjectProperty(
  config: ObjectLiteralExpression,
  property: PropertyAssignment,
  { newName, newValue }: { newName?: string; newValue?: Expression }
): ObjectLiteralExpression {
  ts ??= ensureTypescript();

  if (!newName && !newValue) {
    throw new Error('newName or newValue must be provided');
  }

  return ts.factory.updateObjectLiteralExpression(
    config,
    config.properties.map((p) =>
      p === property
        ? ts.factory.updatePropertyAssignment(
            p,
            newName ? ts.factory.createIdentifier(newName) : p.name,
            newValue ? newValue : p.initializer
          )
        : p
    )
  );
}

function* allTargetOptions<T>(
  target: TargetConfiguration<T>
): Iterable<[string | undefined, T]> {
  if (target.options) {
    yield [undefined, target.options];
  }

  if (!target.configurations) {
    return;
  }

  for (const [name, options] of Object.entries(target.configurations)) {
    if (options !== undefined) {
      yield [name, options];
    }
  }
}
