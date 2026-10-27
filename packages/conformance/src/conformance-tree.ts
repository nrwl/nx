import type { FileChange } from '@nx/devkit';
import { FsTree } from '@nx/devkit/internal';

/**
 * A simplified version the FsTree from nx which prevents any mutations, intended for use in conformance rule implementations.
 * Any changes to the tree as a result of conformance rule logic should instead be applied via a fixGenerator, which receives
 * a writable FsTree.
 */
export class ConformanceTree extends FsTree {
  protected isReadOnly: boolean;

  constructor(
    root: string,
    isVerbose: boolean,
    logOperationId?: string,
    isReadOnly = true
  ) {
    super(root, isVerbose, logOperationId);
    this.isReadOnly = isReadOnly;
  }

  listChanges(): FileChange[] {
    if (this.isReadOnly) {
      return [];
    }
    return super.listChanges();
  }

  rename(...args: Parameters<FsTree['rename']>): never | void {
    if (this.isReadOnly) {
      throw new Error(this.createErrorMessage('tree.rename'));
    }
    return super.rename(...args);
  }

  write(...args: Parameters<FsTree['write']>): never | void {
    if (this.isReadOnly) {
      throw new Error(this.createErrorMessage('tree.write'));
    }
    return super.write(...args);
  }

  delete(...args: Parameters<FsTree['delete']>): never | void {
    if (this.isReadOnly) {
      throw new Error(this.createErrorMessage('tree.delete'));
    }
    return super.delete(...args);
  }

  changePermissions(
    ...args: Parameters<FsTree['changePermissions']>
  ): never | void {
    if (this.isReadOnly) {
      throw new Error(this.createErrorMessage('tree.changePermissions'));
    }
    return super.changePermissions(...args);
  }

  private createErrorMessage(operation: string): string {
    return `${operation} is not available on a ConformanceTree within a rule implementation. Changes to the workspace should be applied via a rule's fixGenerator tree instead.`;
  }
}

export class ReadOnlyConformanceTree extends ConformanceTree {
  // Unique property just to differentiate the type
  private readonly READ_ONLY = true;

  constructor(root: string, isVerbose: boolean, logOperationId?: string) {
    super(root, isVerbose, logOperationId, true);
  }
}

export class WritableConformanceTree extends ConformanceTree {
  // Unique property just to differentiate the type
  private readonly WRITABLE = true;

  constructor(root: string, isVerbose: boolean, logOperationId?: string) {
    super(root, isVerbose, logOperationId, false);
  }
}

export function convertToReadOnly(
  tree: ConformanceTree
): ReadOnlyConformanceTree {
  (tree as any).isReadOnly = true;
  return tree as unknown as ReadOnlyConformanceTree;
}

export function convertToWritable(
  tree: ConformanceTree
): WritableConformanceTree {
  (tree as any).isReadOnly = false;
  return tree as unknown as WritableConformanceTree;
}
