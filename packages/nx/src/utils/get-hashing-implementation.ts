import { NativeFileHasher } from '../hasher/native-file-hasher';

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
