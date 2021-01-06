import { join } from 'path';
import { FileChange } from '@nrwl/tao/src/shared/tree';
import { Generator, GeneratorCallback } from '@nrwl/tao/src/shared/workspace';

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
  return (tree, context) => {
    if (context.engine.workflow) {
      const engineHost = (context.engine.workflow as any).engineHost;
      engineHost.registerTaskExecutor(createRunCallbackTask());
    }

    const adapterTree = new DevkitTreeFromAngularDevkitTree(tree);
    const result = generator(adapterTree, options);

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
  constructor(private tree) {}

  get root(): string {
    return this.tree.root.path;
  }

  children(dirPath: string): string[] {
    const { subdirs, subfiles } = this.tree.getDir(dirPath);
    return [
      ...subdirs.map((fragment) => join(this.root, fragment)),
      ...subfiles.map((fragment) => join(this.root, fragment)),
    ];
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
    const fileChanges = [];
    for (const action of this.tree.actions) {
      if (action.kind === 'r') {
        fileChanges.push({
          path: action.path,
          type: 'CREATE',
          content: this.read(action.path),
        });
        fileChanges.push({
          path: action.to,
          type: 'DELETE',
          content: null,
        });
      } else if (action.kind === 'c' || action.kind === 'o') {
        fileChanges.push({
          path: action.path,
          type: actionToFileChangeMap[action.kind],
          content: action.content,
        });
      } else {
        fileChanges.push({
          path: action.path,
          type: 'DELETE',
          content: null,
        });
      }
    }
    return fileChanges;
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
