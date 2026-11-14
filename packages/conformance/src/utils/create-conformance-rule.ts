import type { ConformanceRule } from '../types';

export function createConformanceRule<RuleOptions = undefined>(
  rule: ConformanceRule<RuleOptions>
): ConformanceRule<RuleOptions> {
  return rule;
}
