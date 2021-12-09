import { Plugin } from 'rollup';

export function swc(): Plugin {
  const { transform } = require('@swc/core');
  return {
    name: 'nx-swc',
    transform(code, filename) {
      return transform(code, {
        filename,
      });
    },
  };
}
