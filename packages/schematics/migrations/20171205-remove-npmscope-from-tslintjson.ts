import { updateJsonFile } from '../../shared/fileutils';

export default {
  description: 'Remove npmScope from tslint.json',
  run: () => {
    updateJsonFile('tslint.json', json => {
      const ruleName = 'nx-enforce-module-boundaries';
      const rule = ruleName in json.rules ? json.rules[ruleName] : null;

      // Only modify when the rule is configured with optional arguments
      if (Array.isArray(rule) && typeof rule[1] === 'object' && rule[1] !== null) {
        rule[1].npmScope = undefined;
      }
    });
  }
};
