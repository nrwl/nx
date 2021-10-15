export interface HashFormat {
  chunk: string;
  extract: string;
  file: string;
  script: string;
}

export function getOutputHashFormat(option: string, length = 20): HashFormat {
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
