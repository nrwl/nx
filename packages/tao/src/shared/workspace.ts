import * as fs from 'fs';
import * as path from 'path';
import * as stripJsonComments from 'strip-json-comments';
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
   * These defaults are project specific.
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
  constructor(private root: string) {}

  relativeCwd(cwd: string) {
    let relativeCwd = cwd.replace(/\\/g, '/').split(this.root)[1];
    if (relativeCwd) {
      return relativeCwd.startsWith('/')
        ? relativeCwd.substring(1)
        : relativeCwd;
    } else {
      return null;
    }
  }

  calculateDefaultProjectName(cwd: string, wc: WorkspaceConfiguration) {
    const relativeCwd = this.relativeCwd(cwd);
    if (relativeCwd) {
      const matchingProject = Object.keys(wc.projects).find((p) => {
        const projectRoot = wc.projects[p].root;
        return (
          relativeCwd == projectRoot ||
          relativeCwd.startsWith(`${projectRoot}/`)
        );
      });
      if (matchingProject) return matchingProject;
    }
    return wc.defaultProject;
  }

  readWorkspaceConfiguration(): WorkspaceConfiguration {
    const w = JSON.parse(
      stripJsonComments(
        fs
          .readFileSync(path.join(this.root, workspaceConfigName(this.root)))
          .toString()
      )
    );
    return toNewFormat(w);
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
      const schema = JSON.parse(
        stripJsonComments(fs.readFileSync(schemaPath).toString())
      );
      if (!schema.properties || typeof schema.properties !== 'object') {
        schema.properties = {};
      }
      const [modulePath, exportName] = executorConfig.implementation.split('#');
      const module = require(path.join(executorsDir, modulePath));
      const implementation = module[exportName || 'default'];
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
      const schema = JSON.parse(
        stripJsonComments(fs.readFileSync(schemaPath).toString())
      );
      if (!schema.properties || typeof schema.properties !== 'object') {
        schema.properties = {};
      }
      generatorConfig.implementation =
        generatorConfig.implementation || generatorConfig.factory;
      const [modulePath, exportName] = generatorConfig.implementation.split(
        '#'
      );
      const module = require(path.join(generatorsDir, modulePath));
      const implementation = module[exportName || 'default'];
      return { normalizedGeneratorName, schema, implementation };
    } catch (e) {
      throw new Error(
        `Unable to resolve ${collectionName}:${generatorName}.\n${e.message}`
      );
    }
  }

  private readExecutorsJson(nodeModule: string, executor: string) {
    const packageJsonPath = require.resolve(`${nodeModule}/package.json`, {
      paths: this.resolvePaths(),
    });
    const packageJson = JSON.parse(
      stripJsonComments(fs.readFileSync(packageJsonPath).toString())
    );
    const executorsFile = packageJson.executors
      ? packageJson.executors
      : packageJson.builders;
    const executorsFilePath = require.resolve(
      path.join(path.dirname(packageJsonPath), executorsFile)
    );
    const executorsJson = JSON.parse(
      stripJsonComments(fs.readFileSync(executorsFilePath).toString())
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
      generatorsFilePath = require.resolve(collectionName, {
        paths: this.resolvePaths(),
      });
    } else {
      const packageJsonPath = require.resolve(
        `${collectionName}/package.json`,
        {
          paths: this.resolvePaths(),
        }
      );
      const packageJson = JSON.parse(
        stripJsonComments(fs.readFileSync(packageJsonPath).toString())
      );
      const generatorsFile = packageJson.generators
        ? packageJson.generators
        : packageJson.schematics;
      generatorsFilePath = require.resolve(
        path.join(path.dirname(packageJsonPath), generatorsFile)
      );
    }
    const generatorsJson = JSON.parse(
      stripJsonComments(fs.readFileSync(generatorsFilePath).toString())
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

  private resolvePaths() {
    return this.root ? [this.root, __dirname] : [__dirname];
  }
}

export function reformattedWorkspaceJsonOrNull(w: any) {
  return w.version === 2 ? toNewFormatOrNull(w) : toOldFormatOrNull(w);
}

export function toNewFormat(w: any) {
  const f = toNewFormatOrNull(w);
  return f ? f : w;
}

export function toNewFormatOrNull(w: any) {
  let formatted = false;
  Object.values(w.projects || {}).forEach((project: any) => {
    if (project.architect) {
      renameProperty(project, 'architect', 'targets');
      formatted = true;
    }
    if (project.schematics) {
      renameProperty(project, 'schematics', 'generators');
      formatted = true;
    }
    Object.values(project.targets || {}).forEach((target: any) => {
      if (target.builder) {
        renameProperty(target, 'builder', 'executor');
        formatted = true;
      }
    });
  });

  if (w.schematics) {
    renameProperty(w, 'schematics', 'generators');
    formatted = true;
  }
  if (w.version !== 2) {
    w.version = 2;
    formatted = true;
  }
  return formatted ? w : null;
}

export function toOldFormatOrNull(w: any) {
  let formatted = false;
  Object.values(w.projects || {}).forEach((project: any) => {
    if (project.targets) {
      renameProperty(project, 'targets', 'architect');
      formatted = true;
    }
    if (project.generators) {
      renameProperty(project, 'generators', 'schematics');
      formatted = true;
    }
    Object.values(project.architect || {}).forEach((target: any) => {
      if (target.executor) {
        renameProperty(target, 'executor', 'builder');
        formatted = true;
      }
    });
  });

  if (w.generators) {
    renameProperty(w, 'generators', 'schematics');
    formatted = true;
  }
  if (w.version !== 1) {
    w.version = 1;
    formatted = true;
  }
  return formatted ? w : null;
}

// we have to do it this way to preserve the order of properties
// not to screw up the formatting
function renameProperty(obj: any, from: string, to: string) {
  const copy = { ...obj };
  Object.keys(obj).forEach((k) => {
    delete obj[k];
  });
  Object.keys(copy).forEach((k) => {
    if (k === from) {
      obj[to] = copy[k];
    } else {
      obj[k] = copy[k];
    }
  });
}
