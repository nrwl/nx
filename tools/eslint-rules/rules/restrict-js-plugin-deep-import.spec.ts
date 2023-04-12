import { TSESLint } from '@typescript-eslint/utils';
import { rule, RULE_NAME } from './restrict-js-plugin-deep-import';

const ruleTester = new TSESLint.RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
});

jest.mock('@nrwl/devkit', () => ({
  ...jest.requireActual<any>('@nrwl/devkit'),
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
  ],
  invalid: [
    {
      errors: [{ messageId: 'noDeepImport' }],
      code: `import { createLockFile } from 'nx/src/plugins/js/lock-file/lock-file';`,
      filename: '/root/packages/devkit/src/path/to.ts',
    },
    {
      errors: [{ messageId: 'noDeepRelativeImport' }],
      code: `import { createLockFile } from '../plugins/js/lock-file/lock-file';`,
      filename: '/root/packages/nx/src/path/to.ts',
    },
  ],
});
