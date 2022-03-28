import { NxPlugin } from '../utils/nx-plugin';
import { PackageManager } from '../utils/package-manager';
import { TargetDependencyConfig } from './workspace-json-project-json';

export type ImplicitDependencyEntry<T = '*' | string[]> = {
  [key: string]: T | ImplicitJsonSubsetDependency<T>;
};

export interface ImplicitJsonSubsetDependency<T = '*' | string[]> {
  [key: string]: T | ImplicitJsonSubsetDependency<T>;
}

export interface NxAffectedConfig {
  /**
   * Default based branch used by affected commands.
   */
  defaultBase?: string;
}

export type NxPluginOption =
  | string
  | ({
      [key in keyof Omit<NxPlugin, 'name'>]: boolean;
    } & { plugin: string });

/**
 * Nx.json configuration
 */
export interface NxJsonConfiguration<T = '*' | string[]> {
  /**
   * Optional (additional) Nx.json configuration file which becomes a base for this one
   */
  extends?: string;
  /**
   * Map of files to projects that implicitly depend on them
   */
  implicitDependencies?: ImplicitDependencyEntry<T>;
  /**
   * Dependencies between different target names across all projects
   */
  targetDependencies?: Record<string, TargetDependencyConfig[]>;
  /**
   * NPM Scope that the workspace uses
   */
  npmScope: string;
  /**
   * Default options for `nx affected`
   */
  affected?: NxAffectedConfig;
  /**
   * Where new apps + libs should be placed
   */
  workspaceLayout?: {
    libsDir: string;
    appsDir: string;
  };
  /**
   * Available Task Runners
   */
  tasksRunnerOptions?: {
    [tasksRunnerName: string]: {
      /**
       * Path to resolve the runner
       */
      runner: string;
      /**
       * Default options for the runner
       */
      options?: any;
    };
  };
  /**
   * List of default values used by generators.
   *
   * These defaults are global. They are used when no other defaults are configured.
   *
   * Example:
   *
   * ```
   * {
   *   "@nrwl/react": {
   *     "library": {
   *       "style": "scss"
   *     }
   *   }
   * }
   * ```
   */
  generators?: { [collectionName: string]: { [generatorName: string]: any } };

  /**
   * Default generator collection. It is used when no collection is provided.
   */
  cli?: {
    packageManager?: PackageManager;
    defaultCollection?: string;
    defaultProjectName?: string;
  };
  /**
   * Plugins for extending the project graph.
   * Should be either a string used to resolve the plugin, or an options block.
   *
   * @example ["@acme/my-plugin"]
   * @example [{"plugin": "@acme/my-plugin", "registerProjectTargets": false}]
   */
  plugins?: NxPluginOption[];

  /**
   * Configuration for Nx Plugins
   */
  pluginsConfig?: Record<string, unknown>;

  /**
   * Default project. When project isn't provided, the default project
   * will be used. Convenient for small workspaces with one main application.
   */
  defaultProject?: string;
}

/**
 * @deprecated(v14): nx.json no longer contains projects
 */
export interface NxJsonProjectConfiguration {
  implicitDependencies?: string[];
  tags?: string[];
}
