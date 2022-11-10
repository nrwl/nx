import { readJsonFile } from '@nrwl/devkit';
import { Plugin } from 'rollup';

export function swc(swcConfig: string): Plugin {
  const { transform } = require('@swc/core');
  let config = {};

  if (swcConfig) {
    config = readJsonFile(swcConfig);
  }

  return {
    name: 'nx-swc',
    transform(code, filename) {
      return transform(code, {
        filename,
        jsc: {
          transform: {
            react: { runtime: 'automatic' },
          },
        },
        ...config,
      });
    },
  };
}
