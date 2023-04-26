import { NodeBasedFileHasher } from './node-based-file-hasher';
import { FileHasherBase } from './file-hasher-base';
import { NativeFileHasher } from './native-file-hasher';
import {
  HasherImplementation,
  getHashingImplementation,
} from '../utils/get-hashing-implementation';

function createFileHasher(): FileHasherBase {
  switch (getHashingImplementation()) {
    case HasherImplementation.Native:
      return new NativeFileHasher();
    case HasherImplementation.Node:
      return new NodeBasedFileHasher();
  }
}

export const defaultFileHasher = createFileHasher();
