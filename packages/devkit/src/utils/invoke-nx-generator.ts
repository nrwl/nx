import { join, relative } from 'path';
import { FileChange } from '@nrwl/tao/src/shared/tree';
import { Generator, GeneratorCallback } from '@nrwl/tao/src/shared/workspace';
import { readFileSync, statSync } from 'fs';

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
 * Convert an Nx Generator into an Angular Devkit Schematic
 */
export function convertNxGenerator<T = any>(generator: Generator<T>) {
  return (options: T) => invokeNxGenerator(generator, options);
}

/**
 * Create a Rule to invoke an Nx Generator
 */
function invokeNxGenerator<T = any>(generator: Generator<T>, options: T) {
  return async (tree, context) => {
    if (context.engine.workflow) {
      const engineHost = (context.engine.workflow as any).engineHost;
      engineHost.registerTaskExecutor(createRunCallbackTask());
    }

    const root = context.engine.workflow
      ? context.engine.workflow.engineHost.paths[1]
      : tree.root.path;

    const adapterTree = new DevkitTreeFromAngularDevkitTree(tree, root);
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

class DevkitTreeFromAngularDevkitTree {
  constructor(private tree, private _root: string) {}

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
    return this.tree.exists(filePath);
  }

  isFile(filePath: string): boolean {
    return this.tree.exists(filePath) && !!this.tree.read(filePath);
  }

  listChanges(): FileChange[] {
    let fileChanges = [];
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
        const actionPath = join(this.root, action.path);

        // If the angular devkit tree is overwriting a file, we check if it already exists on disk
        // If it does exist on disk and it is identical to what the angular devkit tree will overwrite the file with, we omit the file change
        try {
          if (
            action.kind === 'o' &&
            statSync(actionPath).isFile() &&
            readFileSync(actionPath) &&
            action.content.equals(readFileSync(actionPath))
          ) {
            // Remove all existing file changes.
            fileChanges = fileChanges.filter((a) => a.path === action.path);
            continue;
          }
        } catch (e) {}

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

  private normalize(path) {
    return relative(this.root, join(this.root, path));
  }

  read(filePath: string): Buffer | null {
    return this.tree.read(filePath);
  }

  rename(from: string, to: string): void {
    this.tree.rename(from, to);
  }

  write(filePath: string, content: Buffer | string): void {
    if (this.tree.exists(filePath)) {
      this.tree.overwrite(filePath, content);
    } else {
      this.tree.create(filePath, content);
    }
  }
}
