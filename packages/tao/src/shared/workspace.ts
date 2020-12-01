import * as fs from 'fs';
import * as path from 'path';
import '../compat/compat';

/**
 * Workspace configuration
 */
export interface WorkspaceConfiguration {
  /**
   * Projects' configurations
   */
  projects: { [projectName: string]: ProjectConfiguration };

  /**
   * Default project. When project isn't provided, the default project
   * will be used. Convenient for small workspaces with one main application.
   */
  defaultProject?: string;

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
  cli?: { defaultCollection: string };
}

/**
 * Project configuration
 */
export interface ProjectConfiguration {
  /**
   * Project's targets
   */
  targets: { [targetName: string]: TargetConfiguration };

  /**
   * Project's location relative to the root of the workspace
   */
  root: string;

  /**
   * The location of project's sources relative to the root of the workspace
   */
  sourceRoot?: string;

  /**
   * Project type
   */
  projectType?: 'library' | 'application';

  /**
   * List of default values used by generators.
   *
   * These defaults are scoped to a project. They override global defaults.
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
}

/**
 * Target's configuration
 */
export interface TargetConfiguration {
  /**
   * The executor/builder used to implement the target.
   *
   * Example: '@nrwl/web:package'
   */
  executor: string;

  /**
   * Target's options. They are passed in to the executor.
   */
  options?: any;

  /**
   * Sets of options
   */
  configurations?: { [config: string]: any };

  /**
   * List of the target's outputs. The outputs will be cached by the Nx computation
   * caching engine.
   */
  outputs?: string[];
}

export function workspaceConfigName(root: string) {
  try {
    fs.statSync(path.join(root, 'angular.json'));
    return 'angular.json';
  } catch (e) {
    return 'workspace.json';
  }
}

export class Workspaces {
  readWorkspaceConfiguration(root: string): WorkspaceConfiguration {
    const w = JSON.parse(
      fs.readFileSync(path.join(root, workspaceConfigName(root))).toString()
    );
    return this.fromOldToNewFormat(w);
  }

  fromOldToNewFormat(w: any) {
    Object.values(w.projects || {}).forEach((project: any) => {
      if (project.architect) {
        project.targets = project.architect;
        delete project.architect;
      }

      Object.values(project.targets || {}).forEach((target: any) => {
        if (target.builder) {
          target.executor = target.builder;
          delete target.builder;
        }
      });

      if (project.schematics) {
        project.generators = project.schematics;
        delete project.schematics;
      }
    });

    if (w.schematics) {
      w.generators = w.schematics;
      delete w.schematics;
    }
    return w;
  }

  fromNewToOldFormat(w: any) {
    Object.values(w.projects || {}).forEach((project: any) => {
      if (project.targets) {
        project.architect = project.targets;
        delete project.targets;
      }

      Object.values(project.architect || {}).forEach((target: any) => {
        if (target.executor) {
          target.builder = target.executor;
          delete target.execuctor;
        }
      });

      if (project.generators) {
        project.schematics = project.generators;
        delete project.generators;
      }
    });

    if (w.generators) {
      w.schematics = w.generators;
      delete w.generators;
    }
    return w;
  }

  isNxExecutor(nodeModule: string, executor: string) {
    const schema = this.readExecutor(nodeModule, executor).schema;
    return schema['cli'] === 'nx';
  }

  isNxGenerator(collectionName: string, generatorName: string) {
    const schema = this.readGenerator(collectionName, generatorName).schema;
    return schema['cli'] === 'nx';
  }

  readExecutor(nodeModule: string, executor: string) {
    try {
      const { executorsFilePath, executorConfig } = this.readExecutorsJson(
        nodeModule,
        executor
      );
      const executorsDir = path.dirname(executorsFilePath);
      const schemaPath = path.join(executorsDir, executorConfig.schema || '');
      const schema = JSON.parse(fs.readFileSync(schemaPath).toString());
      const module = require(path.join(
        executorsDir,
        executorConfig.implementation
      ));
      const implementation = module.default;
      return { schema, implementation };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${nodeModule}:${executor}.\n${e.message}`
      );
    }
  }

  readGenerator(collectionName: string, generatorName: string) {
    try {
      const {
        generatorsFilePath,
        generatorsJson,
        normalizedGeneratorName,
      } = this.readGeneratorsJson(collectionName, generatorName);
      const generatorsDir = path.dirname(generatorsFilePath);
      const generatorConfig = (generatorsJson.generators ||
        generatorsJson.schematics)[normalizedGeneratorName];
      const schemaPath = path.join(generatorsDir, generatorConfig.schema || '');
      const schema = JSON.parse(fs.readFileSync(schemaPath).toString());
      const module = require(path.join(
        generatorsDir,
        generatorConfig.implementation
          ? generatorConfig.implementation
          : generatorConfig.factory
      ));
      const implementation = module.default;
      return { schema, implementation };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${collectionName}:${generatorName}.\n${e.message}`
      );
    }
  }

  private readExecutorsJson(nodeModule: string, executor: string) {
    const packageJsonPath = require.resolve(`${nodeModule}/package.json`);
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath).toString());
    const executorsFile = packageJson.executors
      ? packageJson.executors
      : packageJson.builders;
    const executorsFilePath = require.resolve(
      path.join(path.dirname(packageJsonPath), executorsFile)
    );
    const executorsJson = JSON.parse(
      fs.readFileSync(executorsFilePath).toString()
    );
    const mapOfExecutors = executorsJson.executors
      ? executorsJson.executors
      : executorsJson.builders;
    const executorConfig = mapOfExecutors[executor];
    if (!executorConfig) {
      throw new Error(
        `Cannot find executor '${executor}' in ${executorsFilePath}.`
      );
    }
    return { executorsFilePath, executorConfig };
  }

  private readGeneratorsJson(collectionName: string, generator: string) {
    let generatorsFilePath;
    if (collectionName.endsWith('.json')) {
      generatorsFilePath = require.resolve(collectionName);
    } else {
      const packageJsonPath = require.resolve(`${collectionName}/package.json`);
      const packageJson = JSON.parse(
        fs.readFileSync(packageJsonPath).toString()
      );
      const generatorsFile = packageJson.generators
        ? packageJson.generators
        : packageJson.schematics;
      generatorsFilePath = require.resolve(
        path.join(path.dirname(packageJsonPath), generatorsFile)
      );
    }
    const generatorsJson = JSON.parse(
      fs.readFileSync(generatorsFilePath).toString()
    );

    let normalizedGeneratorName;
    const gens = generatorsJson.generators || generatorsJson.schematics;
    for (let k of Object.keys(gens)) {
      if (k === generator) {
        normalizedGeneratorName = k;
        break;
      }
      if (gens[k].aliases && gens[k].aliases.indexOf(generator) > -1) {
        normalizedGeneratorName = k;
        break;
      }
    }

    if (!normalizedGeneratorName) {
      for (let parent of generatorsJson.extends || []) {
        try {
          return this.readGeneratorsJson(parent, generator);
        } catch (e) {}
      }

      throw new Error(
        `Cannot find generator '${generator}' in ${generatorsFilePath}.`
      );
    }
    return { generatorsFilePath, generatorsJson, normalizedGeneratorName };
  }
}
