import { Plugin } from 'rollup';
import { forkTypeChecker } from './fork-type-checker';

export function swc(options: {
  check: boolean;
  workspaceRoot: string;
  projectRoot: string;
  tsconfig: string;
}): Plugin {
  let typeCheck: Promise<void> | null = null;
  try {
    const { transform } = require('@swc/core');
    return {
      name: 'nx-swc',
      buildStart() {
        if (options.check) {
          console.time('type check');
          typeCheck = forkTypeChecker(options);
        }
      },
      buildEnd() {
        if (options.check)
          return typeCheck.finally(() => {
            console.timeEnd('type check');
          });
      },
      transform(code, filename) {
        return transform(code, {
          filename,
        });
      },
    };
  } catch {
    throw new Error(
      '"@swc/core" not installed  in the workspace. Try `npm install --save-dev @swc/core` or `yarn add -D @swc/core`'
    );
  }
}
