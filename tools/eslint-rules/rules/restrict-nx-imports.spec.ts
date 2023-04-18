import { TSESLint } from '@typescript-eslint/utils';
import { rule, RULE_NAME } from './restrict-nx-imports';

const ruleTester = new TSESLint.RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
});

jest.mock('@nrwl/devkit', () => ({
  normalizePath: (path: string) => path,
  workspaceRoot: '/root',
}));

ruleTester.run(RULE_NAME, rule, {
  valid: [
    {
      code: `import { createLockFile } from 'nx/src/plugins/js';`,
      filename: '/root/packages/devkit/src/path/to.ts',
    },
    {
      code: `import { createLockFile } from '../plugins/js';`,
      filename: '/root/packages/nx/src/path/to.ts',
    },
    {
      code: `import { updateJson } from '../../generators/utils/json';`,
      filename: '/root/packages/nx/src/path/to.ts',
    },
  ],
  invalid: [
    {
      errors: [{ messageId: 'noJsImport' }],
      code: `import { createLockFile } from 'nx/src/plugins/js/lock-file/lock-file';`,
      filename: '/root/packages/storybook/src/path/to.ts',
    },
    {
      errors: [{ messageId: 'noCircularNx' }],
      code: `import { updateJson } from 'nx/src/devkit-exports';`,
      filename: '/root/packages/nx/src/path/to.ts',
    },
  ],
});
