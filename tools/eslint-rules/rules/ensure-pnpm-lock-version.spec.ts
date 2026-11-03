import { RuleTester } from '@typescript-eslint/rule-tester';
import { rule, RULE_NAME } from './ensure-pnpm-lock-version';
const parser = require('../raw-file-parser');

const ruleTester = new RuleTester({ languageOptions: { parser } });
const options = [{ version: '9.0' }];

ruleTester.run(RULE_NAME, rule, {
  valid: [
    { code: "lockfileVersion: '9.0'\n", options },
    { code: "lockfileVersion: '9.0'", options },
    {
      code: "---\nlockfileVersion: '9.0'\nimporters: {}\n---\nlockfileVersion: '9.0'\nimporters: {}\n",
      options,
    },
    {
      code: "---\nlockfileVersion: '8.0'\n---\nlockfileVersion: '9.0'\n",
      options,
    },
    // The rule only reads the head of the document, so a long one still works.
    {
      code: `---\nlockfileVersion: '9.0'\n${'  padding: value\n'.repeat(1000)}`,
      options,
    },
  ],
  invalid: [
    {
      code: "---\nlockfileVersion: '9.0'\n---\nlockfileVersion: '8.0'\n",
      options,
      errors: [{ messageId: 'incorrectLockfileVersion' }],
    },
    {
      code: "---\nlockfileVersion: '9.0'\n---\nimporters: {}\n",
      options,
      errors: [{ messageId: 'unparseableLockfileVersion' }],
    },
    {
      code: 'lockfileVersion: [\n',
      options,
      errors: [{ messageId: 'unparseableLockfileVersion' }],
    },
  ],
});
