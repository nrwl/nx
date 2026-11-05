import { writeJson, type Tree } from '@nx/devkit';
import { getTypescriptBackend } from '@nx/devkit/internal';
import { TempFs } from '@nx/devkit/internal-testing-utils';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { symlinkSync } from 'node:fs';
import { dirname, join } from 'path';
import { getNeededCompilerOptionOverrides } from './configuration';

// Real installs: the repo's `typescript` is TS 6, and 7.1 is aliased.
const typescriptInstalls = [
  ['classic', dirname(require.resolve('typescript/package.json'))],
  ['api', dirname(require.resolve('@typescript/native/package.json'))],
] as const;

describe.each(typescriptInstalls)(
  'getNeededCompilerOptionOverrides with the %s TypeScript backend',
  (backendKind, typescriptDir) => {
    let fs: TempFs;
    let tree: Tree;

    beforeEach(() => {
      fs = new TempFs('nx-compiler-option-overrides');
      fs.createDirSync('node_modules');
      symlinkSync(
        typescriptDir,
        join(fs.tempDir, 'node_modules/typescript'),
        'dir'
      );
      expect(getTypescriptBackend().kind).toBe(backendKind);

      tree = createTreeWithEmptyWorkspace();
      writeJson(tree, 'tsconfig.base.json', {
        compilerOptions: {
          target: 'es2022',
          module: 'esnext',
          moduleResolution: 'bundler',
          jsx: 'react-jsx',
          newLine: 'lf',
          moduleDetection: 'force',
          strict: true,
        },
      });
      writeJson(tree, 'libs/a/tsconfig.json', {
        extends: '../../tsconfig.base.json',
      });
    });

    afterEach(() => {
      fs.cleanup();
    });

    it('should drop the options the tsconfig already sets, in any spelling TypeScript accepts', () => {
      const overrides = getNeededCompilerOptionOverrides(
        tree,
        {
          target: 'ES2022',
          module: 'ESNext',
          moduleResolution: 'Bundler',
          jsx: 'React-JSX',
          newLine: 'LF',
          moduleDetection: 'force',
          strict: true,
        },
        'libs/a/tsconfig.json'
      );

      expect(overrides).toEqual({});
    });

    it('should keep the options the tsconfig sets to another value or leaves unset', () => {
      const overrides = getNeededCompilerOptionOverrides(
        tree,
        {
          target: 'es2022',
          module: 'nodenext',
          moduleDetection: 'auto',
          declaration: true,
        },
        'libs/a/tsconfig.json'
      );

      expect(overrides).toEqual({
        module: 'nodenext',
        moduleDetection: 'auto',
        declaration: true,
      });
    });
  }
);
