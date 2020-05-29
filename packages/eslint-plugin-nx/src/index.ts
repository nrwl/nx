import enforceModuleBoundaries, {
  RULE_NAME as enforceModuleBoundariesRuleName,
} from './rules/enforce-module-boundaries';

module.exports = {
  rules: {
    [enforceModuleBoundariesRuleName]: enforceModuleBoundaries,
  },
};
