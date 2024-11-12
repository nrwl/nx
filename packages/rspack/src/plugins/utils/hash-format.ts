import { logger } from '@nx/devkit';

export interface HashFormat {
  chunk: string;
  extract: string;
  file: string;
  script: string;
}

const MAX_HASH_LENGTH = 16;

export function getOutputHashFormat(
  option: string,
  length = MAX_HASH_LENGTH
): HashFormat {
  if (length > MAX_HASH_LENGTH) {
    logger.warn(
      `Hash format length cannot be longer than ${MAX_HASH_LENGTH}. Using default of ${MAX_HASH_LENGTH}.`
    );
    length = MAX_HASH_LENGTH;
  }
  const hashFormats: { [option: string]: HashFormat } = {
    none: { chunk: '', extract: '', file: '', script: '' },
    media: { chunk: '', extract: '', file: `.[hash:${length}]`, script: '' },
    bundles: {
      chunk: `.[chunkhash:${length}]`,
      extract: `.[contenthash:${length}]`,
      file: '',
      script: `.[contenthash:${length}]`,
    },
    all: {
      chunk: `.[chunkhash:${length}]`,
      extract: `.[contenthash:${length}]`,
      file: `.[contenthash:${length}]`,
      script: `.[contenthash:${length}]`,
    },
  };
  return hashFormats[option] || hashFormats['none'];
}
