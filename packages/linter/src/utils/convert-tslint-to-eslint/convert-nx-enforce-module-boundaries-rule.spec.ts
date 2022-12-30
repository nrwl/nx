import { convertTslintNxRuleToEslintNxRule } from './convert-nx-enforce-module-boundaries-rule';

describe('convertTslintNxRuleToEslintNxRule()', () => {
  const configFromNxExamplesRepo = {
    allow: ['@nx-example/shared/product/data/testing'],
    depConstraints: [
      {
        sourceTag: 'type:app',
        onlyDependOnLibsWithTags: ['type:feature', 'type:ui'],
      },
      {
        sourceTag: 'type:feature',
        onlyDependOnLibsWithTags: [
          'type:ui',
          'type:data',
          'type:types',
          'type:state',
        ],
      },
      {
        sourceTag: 'type:types',
        onlyDependOnLibsWithTags: ['type:types'],
      },
      {
        sourceTag: 'type:state',
        onlyDependOnLibsWithTags: ['type:state', 'type:types', 'type:data'],
      },
      {
        sourceTag: 'type:data',
        onlyDependOnLibsWithTags: ['type:types'],
      },
      {
        sourceTag: 'type:e2e',
        onlyDependOnLibsWithTags: ['type:e2e-utils'],
      },
      {
        sourceTag: 'type:ui',
        onlyDependOnLibsWithTags: ['type:types', 'type:ui'],
      },
      {
        sourceTag: 'scope:products',
        onlyDependOnLibsWithTags: ['scope:products', 'scope:shared'],
      },
      {
        sourceTag: 'scope:cart',
        onlyDependOnLibsWithTags: ['scope:cart', 'scope:shared'],
      },
    ],
    enforceBuildableLibDependency: true,
  };

  const testCases = [
    {
      tslintJson: {},
      // Should return null if no existing config found
      expected: null,
    },
    {
      // Real usage in nx-examples repo
      tslintJson: {
        rules: {
          'nx-enforce-module-boundaries': [true, configFromNxExamplesRepo],
        },
      },
      expected: {
        ruleName: '@nrwl/nx/enforce-module-boundaries',
        ruleConfig: ['error', configFromNxExamplesRepo],
      },
    },
    {
      // Should respect boolean
      tslintJson: {
        defaultSeverity: 'warning',
        rules: {
          'nx-enforce-module-boundaries': [false, configFromNxExamplesRepo],
        },
      },
      expected: {
        ruleName: '@nrwl/nx/enforce-module-boundaries',
        ruleConfig: ['off', configFromNxExamplesRepo],
      },
    },
    {
      // Should respect boolean + defaultSeverity format
      tslintJson: {
        defaultSeverity: 'warning',
        rules: {
          'nx-enforce-module-boundaries': [true, configFromNxExamplesRepo],
        },
      },
      expected: {
        ruleName: '@nrwl/nx/enforce-module-boundaries',
        ruleConfig: ['warn', configFromNxExamplesRepo],
      },
    },
    {
      // Should respect object format
      tslintJson: {
        rules: {
          'nx-enforce-module-boundaries': {
            severity: 'error',
            options: [configFromNxExamplesRepo],
          },
        },
      },
      expected: {
        ruleName: '@nrwl/nx/enforce-module-boundaries',
        ruleConfig: ['error', configFromNxExamplesRepo],
      },
    },
    {
      // Should respect object format
      tslintJson: {
        rules: {
          'nx-enforce-module-boundaries': {
            severity: 'warning',
            options: [configFromNxExamplesRepo],
          },
        },
      },
      expected: {
        ruleName: '@nrwl/nx/enforce-module-boundaries',
        ruleConfig: ['warn', configFromNxExamplesRepo],
      },
    },
    {
      // Should respect object format
      tslintJson: {
        rules: {
          'nx-enforce-module-boundaries': {
            severity: 'off',
            options: [configFromNxExamplesRepo],
          },
        },
      },
      expected: {
        ruleName: '@nrwl/nx/enforce-module-boundaries',
        ruleConfig: ['off', configFromNxExamplesRepo],
      },
    },
    {
      // Should respect object format + defaultSeverity option
      tslintJson: {
        defaultSeverity: 'warning',
        rules: {
          'nx-enforce-module-boundaries': {
            severity: 'default',
            options: [configFromNxExamplesRepo],
          },
        },
      },
      expected: {
        ruleName: '@nrwl/nx/enforce-module-boundaries',
        ruleConfig: ['warn', configFromNxExamplesRepo],
      },
    },
  ];

  testCases.forEach((tc, i) => {
    it(`should appropriately convert the nx-enforce-module-boundaries rule usage from TSLint, CASE ${i}`, () => {
      expect(convertTslintNxRuleToEslintNxRule(tc.tslintJson)).toEqual(
        tc.expected
      );
    });
  });
});
