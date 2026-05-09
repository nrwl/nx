import { RuleTester } from '@typescript-eslint/rule-tester';
import * as parser from '@typescript-eslint/parser';
import { rule, RULE_NAME } from './valid-schema-description';

const ruleTester = new RuleTester({
  languageOptions: { parser },
});

ruleTester.run(RULE_NAME, rule, {
  valid: [`const example = true;`],
  invalid: [],
});
