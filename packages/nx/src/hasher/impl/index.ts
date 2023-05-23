import { NodeFileHasher, nodeHashArray } from './node-file-hasher';
import { FileHasher } from './file-hasher-base';
import { NativeFileHasher, nativeHashArray } from './native-file-hasher';

export enum HasherImplementation {
  Native = 'Native',
  Node = 'Node',
}

export function getHashingImplementation() {
  try {
    if (
      (!process.env.NX_NON_NATIVE_HASHER ||
        process.env.NX_NON_NATIVE_HASHER != 'true') &&
      NativeFileHasher.available()
    ) {
      return HasherImplementation.Native;
    }

    return HasherImplementation.Node;
  } catch {
    return HasherImplementation.Node;
  }
}

function createFileHasher(): FileHasher {
  switch (getHashingImplementation()) {
    case HasherImplementation.Native:
      return new NativeFileHasher();
    case HasherImplementation.Node:
      return new NodeFileHasher();
  }
}

function createHashArray(): (content: string[]) => string {
  switch (getHashingImplementation()) {
    case HasherImplementation.Native:
      return nativeHashArray;
    case HasherImplementation.Node:
      return nodeHashArray;
  }
}

export const fileHasher = createFileHasher();
export const hashArray = createHashArray();
