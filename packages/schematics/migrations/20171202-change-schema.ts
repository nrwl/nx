import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Update the schema file to reflect the `allow` option for `nx-enforce-module-boundaries`.',
  run: () => {
    updateJsonFile('tslint.json', json => {
      const ruleName = 'nx-enforce-module-boundaries';
      const ruleOptionName = 'allow';
      const rule = ruleName in json.rules ? json.rules[ruleName] : null;

      // Only modify when the rule is configured with optional arguments
      if (Array.isArray(rule) && typeof rule[1] === 'object' && rule[1] !== null) {
        rule[1][ruleOptionName] = [];
      }
    });
  }
};
