import { logger, stripIndent } from 'nx/src/utils/logger';
import type { FileChange, Tree, TreeWriteOptions } from 'nx/src/shared/tree';
import {
  Generator,
  GeneratorCallback,
  toNewFormat,
  toOldFormatOrNull,
} from 'nx/src/shared/workspace';
import { parseJson, serializeJson } from 'nx/src/utils/json';
import { join, relative } from 'path';

class RunCallbackTask {
  constructor(private callback: GeneratorCallback) {}
  toConfiguration() {
    return {
      name: 'RunCallback',
      options: {
        callback: this.callback,
      },
    };
  }
}

function createRunCallbackTask() {
  return {
    name: 'RunCallback',
    create: () => {
      return Promise.resolve(
        async ({ callback }: { callback: GeneratorCallback }) => {
          await callback();
        }
      );
    },
  };
}

/**
 * Convert an Nx Generator into an Angular Devkit Schematic.
 * @param generator The Nx generator to convert to an Angular Devkit Schematic.
 * @param skipWritingConfigInOldFormat Whether to skip writing the configuration in the old format (the one used by the Angular DevKit).
 */
export function convertNxGenerator<T = any>(
  generator: Generator<T>,
  skipWritingConfigInOldFormat: boolean = false
) {
  // eslint-disable-next-line @typescript-eslint/explicit-module-boundary-types
  return (generatorOptions: T) =>
    invokeNxGenerator(
      generator,
      generatorOptions,
      skipWritingConfigInOldFormat
    );
}

/**
 * Create a Rule to invoke an Nx Generator
 */
function invokeNxGenerator<T = any>(
  generator: Generator<T>,
  options: T,
  skipWritingConfigInOldFormat?: boolean
) {
  return async (tree, context) => {
    if (context.engine.workflow) {
      const engineHost = (context.engine.workflow as any).engineHost;
      engineHost.registerTaskExecutor(createRunCallbackTask());
    }

    const root =
      context.engine.workflow && context.engine.workflow.engineHost.paths
        ? context.engine.workflow.engineHost.paths[1]
        : tree.root.path;

    const adapterTree = new DevkitTreeFromAngularDevkitTree(
      tree,
      root,
      skipWritingConfigInOldFormat
    );
    const result = await generator(adapterTree, options);

    if (!result) {
      return adapterTree['tree'];
    }
    if (typeof result === 'function') {
      if (context.engine.workflow) {
        context.addTask(new RunCallbackTask(result));
      }
    }
  };
}

const actionToFileChangeMap = {
  c: 'CREATE',
  o: 'UPDATE',
  d: 'DELETE',
};

class DevkitTreeFromAngularDevkitTree implements Tree {
  private configFileName: string;

  constructor(
    private tree,
    private _root: string,
    private skipWritingConfigInOldFormat?: boolean
  ) {}

  get root(): string {
    return this._root;
  }

  children(dirPath: string): string[] {
    const { subdirs, subfiles } = this.tree.getDir(dirPath);
    return [...subdirs, ...subfiles];
  }

  delete(filePath: string): void {
    this.tree.delete(filePath);
  }

  exists(filePath: string): boolean {
    if (this.isFile(filePath)) {
      return this.tree.exists(filePath);
    } else {
      return this.children(filePath).length > 0;
    }
  }

  isFile(filePath: string): boolean {
    return this.tree.exists(filePath) && !!this.tree.read(filePath);
  }

  listChanges(): FileChange[] {
    const fileChanges = [];
    for (const action of this.tree.actions) {
      if (action.kind === 'r') {
        fileChanges.push({
          path: this.normalize(action.to),
          type: 'CREATE',
          content: this.read(action.to),
        });
        fileChanges.push({
          path: this.normalize(action.path),
          type: 'DELETE',
          content: null,
        });
      } else if (action.kind === 'c' || action.kind === 'o') {
        fileChanges.push({
          path: this.normalize(action.path),
          type: actionToFileChangeMap[action.kind],
          content: action.content,
        });
      } else {
        fileChanges.push({
          path: this.normalize(action.path),
          type: 'DELETE',
          content: null,
        });
      }
    }
    return fileChanges;
  }

  private normalize(path: string): string {
    return relative(this.root, join(this.root, path));
  }

  read(filePath: string): Buffer;
  read(filePath: string, encoding: BufferEncoding): string;
  read(filePath: string, encoding?: BufferEncoding) {
    const rawResult = encoding
      ? this.tree.read(filePath).toString(encoding)
      : this.tree.read(filePath);
    if (isWorkspaceJsonChange(filePath)) {
      const formatted = toNewFormat(
        parseJson(Buffer.isBuffer(rawResult) ? rawResult.toString() : rawResult)
      );
      return encoding ? serializeJson(formatted) : serializeJson(formatted);
    }
    return rawResult;
  }

  rename(from: string, to: string): void {
    this.tree.rename(from, to);
  }

  write(
    filePath: string,
    content: Buffer | string,
    options?: TreeWriteOptions
  ): void {
    if (options?.mode) {
      this.warnUnsupportedFilePermissionsChange(filePath, options.mode);
    }

    if (!this.skipWritingConfigInOldFormat && isWorkspaceJsonChange(filePath)) {
      const w = parseJson(content.toString());
      for (const [project, configuration] of Object.entries(w.projects)) {
        if (typeof configuration === 'string') {
          w.projects[project] = parseJson(
            this.tree.read(`${configuration}/project.json`)
          );
          w.projects[project].configFilePath = `${configuration}/project.json`;
        }
      }
      const formatted = toOldFormatOrNull(w);
      content = serializeJson(formatted ? formatted : w);
    }

    if (this.tree.exists(filePath)) {
      this.tree.overwrite(filePath, content);
    } else {
      this.tree.create(filePath, content);
    }
  }

  changePermissions(filePath: string, mode: string | number): void {
    this.warnUnsupportedFilePermissionsChange(filePath, mode);
  }

  private warnUnsupportedFilePermissionsChange(
    filePath: string,
    mode: string | number
  ) {
    logger.warn(
      stripIndent(`The Angular DevKit tree does not support changing a file permissions.
                  Ignoring changing ${filePath} permissions to ${mode}.`)
    );
  }
}

function isWorkspaceJsonChange(path) {
  return (
    path === 'workspace.json' ||
    path === '/workspace.json' ||
    path === 'angular.json' ||
    path === '/angular.json'
  );
}
