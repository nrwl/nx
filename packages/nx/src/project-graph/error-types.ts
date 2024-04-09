import { CreateNodesResultWithContext } from './plugins/internal-api';
import { ConfigurationResult } from './utils/project-configuration-utils';

export class ProjectConfigurationsError extends Error {
  constructor(
    public readonly errors: Array<MergeNodesError | CreateNodesError>,
    public readonly partialProjectConfigurationsResult: ConfigurationResult
  ) {
    super('Failed to create project configurations');
    this.name = this.constructor.name;
  }
}

export class CreateNodesError extends Error {
  file: string;
  pluginName: string;

  constructor({
    file,
    pluginName,
    error,
  }: {
    file: string;
    pluginName: string;
    error: Error;
  }) {
    const msg = `The "${pluginName}" plugin threw an error while creating nodes from ${file}:`;

    super(msg, { cause: error });
    this.name = this.constructor.name;
    this.file = file;
    this.pluginName = pluginName;
    this.stack = `${this.message}\n  ${error.stack.split('\n').join('\n  ')}`;
  }
}

export class AggregateCreateNodesError extends Error {
  constructor(
    public readonly pluginName: string,
    public readonly errors: Array<CreateNodesError>,
    public readonly partialResults: Array<CreateNodesResultWithContext>
  ) {
    super('Failed to create nodes');
    this.name = this.constructor.name;
  }
}

export class MergeNodesError extends Error {
  file: string;
  pluginName: string;

  constructor({
    file,
    pluginName,
    error,
  }: {
    file: string;
    pluginName: string;
    error: Error;
  }) {
    const msg = `The nodes created from ${file} by the "${pluginName}" could not be merged into the project graph:`;

    super(msg, { cause: error });
    this.name = this.constructor.name;
    this.file = file;
    this.pluginName = pluginName;
    this.stack = `${this.message}\n  ${error.stack.split('\n').join('\n  ')}`;
  }
}

export function isCreateNodesError(e: unknown): e is CreateNodesError {
  return (
    e instanceof CreateNodesError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === CreateNodesError.prototype.name)
  );
}

export function isAggregateCreateNodesError(
  e: unknown
): e is AggregateCreateNodesError {
  return (
    e instanceof AggregateCreateNodesError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === AggregateCreateNodesError.prototype.name)
  );
}

export function isMergeNodesError(e: unknown): e is MergeNodesError {
  return (
    e instanceof MergeNodesError ||
    (typeof e === 'object' &&
      'name' in e &&
      e?.name === MergeNodesError.prototype.name)
  );
}
