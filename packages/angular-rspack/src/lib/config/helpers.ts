import { OutputHashing, HashFormat } from '../models';

export function getOutputHashFormat(
  outputHashing: OutputHashing = 'none',
  length = 8
): HashFormat {
  const hashTemplate = `.[contenthash:${length}]`;

  switch (outputHashing) {
    case 'media':
      return {
        chunk: '',
        extract: '',
        file: hashTemplate,
        script: '',
      };
    case 'bundles':
      return {
        chunk: hashTemplate,
        extract: hashTemplate,
        file: '',
        script: hashTemplate,
      };
    case 'all':
      return {
        chunk: hashTemplate,
        extract: hashTemplate,
        file: hashTemplate,
        script: hashTemplate,
      };
    case 'none':
    default:
      return {
        chunk: '',
        extract: '',
        file: '',
        script: '',
      };
  }
}
