import { Plugin } from 'rollup';

export function swc(options = {}): Plugin {
  try {
    const { transform } = require('@swc/core');
    return {
      name: 'nx-swc',
      transform(code, filename) {
        return transform(code, {
          filename,
          ...options,
        });
      },
    };
  } catch {
    throw new Error(
      '"@swc/core" not installed  in the workspace. Try `npm install --save-dev @swc/core` or `yarn add -D @swc/core`'
    );
  }
}
