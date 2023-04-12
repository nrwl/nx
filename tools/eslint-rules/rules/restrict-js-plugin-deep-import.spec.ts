import { TSESLint } from '@typescript-eslint/utils';
import { rule, RULE_NAME } from './restrict-js-plugin-deep-import';

const ruleTester = new TSESLint.RuleTester({
  parser: require.resolve('@typescript-eslint/parser'),
});

ruleTester.run(RULE_NAME, rule, {
  valid: [`const example = true;`],
  invalid: [],
});
