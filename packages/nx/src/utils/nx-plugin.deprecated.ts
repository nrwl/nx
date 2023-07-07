import { ProjectGraphProcessor } from '../config/project-graph';
import { TargetConfiguration } from '../config/workspace-json-project-json';

/**
 * @deprecated(v18) Add targets to the nodes when building them instead.
 */
export type ProjectTargetConfigurator = (
  file: string
) => Record<string, TargetConfiguration>;

/**
 * @deprecated(v18) Use v2 plugins w/ buildProjectNodes and buildProjectDependencies instead.
 */
export type NxPluginV1 = {
  name: string;
  /**
   * @deprecated(v18) Use buildProjectNodes and buildProjectDependencies instead.
   */
  processProjectGraph?: ProjectGraphProcessor;

  /**
   * @deprecated(v18) Add targets to the nodes inside of buildProjectNodes instead.
   */
  registerProjectTargets?: ProjectTargetConfigurator;

  /**
   * A glob pattern to search for non-standard project files.
   * @example: ["*.csproj", "pom.xml"]
   * @deprecated(v18) Use buildProjectNodes instead.
   */
  projectFilePatterns?: string[];
};
