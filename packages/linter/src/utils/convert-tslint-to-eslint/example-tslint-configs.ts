// Based on latest Angular project root tslint.json + enforce-module-boundaries config from nx-examples
export const exampleRootTslintJson = {
  raw: {
    rulesDirectory: [
      'node_modules/@nrwl/workspace/src/tslint',
      'node_modules/codelyzer',
    ],
    linterOptions: {
      exclude: ['**/*'],
    },
    rules: {
      'arrow-return-shorthand': true,
      'callable-types': true,
      'class-name': true,
      deprecation: {
        severity: 'warn',
      },
      forin: true,
      'import-blacklist': [true, 'rxjs/Rx'],
      'interface-over-type-literal': true,
      'member-access': false,
      'member-ordering': [
        true,
        {
          order: [
            'static-field',
            'instance-field',
            'static-method',
            'instance-method',
          ],
        },
      ],
      'no-arg': true,
      'no-bitwise': true,
      'no-console': [true, 'debug', 'info', 'time', 'timeEnd', 'trace'],
      'no-construct': true,
      'no-debugger': true,
      'no-duplicate-super': true,
      'no-empty': false,
      'no-empty-interface': true,
      'no-eval': true,
      'no-inferrable-types': [true, 'ignore-params'],
      'no-misused-new': true,
      'no-non-null-assertion': true,
      'no-shadowed-variable': true,
      'no-string-literal': false,
      'no-string-throw': true,
      'no-switch-case-fall-through': true,
      'no-unnecessary-initializer': true,
      'no-unused-expression': true,
      'no-var-keyword': true,
      'object-literal-sort-keys': false,
      'prefer-const': true,
      radix: true,
      'triple-equals': [true, 'allow-null-check'],
      'unified-signatures': true,
      'variable-name': false,
      'nx-enforce-module-boundaries': [
        true,
        {
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
              onlyDependOnLibsWithTags: [
                'type:state',
                'type:types',
                'type:data',
              ],
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
        },
      ],
      'directive-selector': [true, 'attribute', 'app', 'camelCase'],
      'component-selector': [true, 'element', 'app', 'kebab-case'],
      'no-conflicting-lifecycle': true,
      'no-host-metadata-property': true,
      'no-input-rename': true,
      'no-inputs-metadata-property': true,
      'no-output-native': true,
      'no-output-on-prefix': true,
      'no-output-rename': true,
      'no-outputs-metadata-property': true,
      'template-banana-in-box': true,
      'template-no-negated-async': true,
      'use-lifecycle-interface': true,
      'use-pipe-transform-interface': true,
    },
  },
  tslintPrintConfigResult: {
    rules: {
      'arrow-return-shorthand': { ruleArguments: [], ruleSeverity: 'error' },
      'callable-types': { ruleArguments: [], ruleSeverity: 'error' },
      'class-name': { ruleArguments: [], ruleSeverity: 'error' },
      deprecation: { ruleSeverity: 'warning' },
      forin: { ruleArguments: [], ruleSeverity: 'error' },
      'import-blacklist': { ruleArguments: ['rxjs/Rx'], ruleSeverity: 'error' },
      'interface-over-type-literal': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
      'member-access': { ruleArguments: [], ruleSeverity: 'off' },
      'member-ordering': {
        ruleArguments: [
          {
            order: [
              'static-field',
              'instance-field',
              'static-method',
              'instance-method',
            ],
          },
        ],
        ruleSeverity: 'error',
      },
      'no-arg': { ruleArguments: [], ruleSeverity: 'error' },
      'no-bitwise': { ruleArguments: [], ruleSeverity: 'error' },
      'no-console': {
        ruleArguments: ['debug', 'info', 'time', 'timeEnd', 'trace'],
        ruleSeverity: 'error',
      },
      'no-construct': { ruleArguments: [], ruleSeverity: 'error' },
      'no-debugger': { ruleArguments: [], ruleSeverity: 'error' },
      'no-duplicate-super': { ruleArguments: [], ruleSeverity: 'error' },
      'no-empty': { ruleArguments: [], ruleSeverity: 'off' },
      'no-empty-interface': { ruleArguments: [], ruleSeverity: 'error' },
      'no-eval': { ruleArguments: [], ruleSeverity: 'error' },
      'no-inferrable-types': {
        ruleArguments: ['ignore-params'],
        ruleSeverity: 'error',
      },
      'no-misused-new': { ruleArguments: [], ruleSeverity: 'error' },
      'no-non-null-assertion': { ruleArguments: [], ruleSeverity: 'error' },
      'no-shadowed-variable': { ruleArguments: [], ruleSeverity: 'error' },
      'no-string-literal': { ruleArguments: [], ruleSeverity: 'off' },
      'no-string-throw': { ruleArguments: [], ruleSeverity: 'error' },
      'no-switch-case-fall-through': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
      'no-unnecessary-initializer': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
      'no-unused-expression': { ruleArguments: [], ruleSeverity: 'error' },
      'no-var-keyword': { ruleArguments: [], ruleSeverity: 'error' },
      'object-literal-sort-keys': { ruleArguments: [], ruleSeverity: 'off' },
      'prefer-const': { ruleArguments: [], ruleSeverity: 'error' },
      radix: { ruleArguments: [], ruleSeverity: 'error' },
      'triple-equals': {
        ruleArguments: ['allow-null-check'],
        ruleSeverity: 'error',
      },
      'unified-signatures': { ruleArguments: [], ruleSeverity: 'error' },
      'variable-name': { ruleArguments: [], ruleSeverity: 'off' },
      'nx-enforce-module-boundaries': {
        ruleArguments: [
          {
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
                onlyDependOnLibsWithTags: [
                  'type:state',
                  'type:types',
                  'type:data',
                ],
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
          },
        ],
        ruleSeverity: 'error',
      },
      'directive-selector': {
        ruleArguments: ['attribute', 'app', 'camelCase'],
        ruleSeverity: 'error',
      },
      'component-selector': {
        ruleArguments: ['element', 'app', 'kebab-case'],
        ruleSeverity: 'error',
      },
      'no-conflicting-lifecycle': { ruleArguments: [], ruleSeverity: 'error' },
      'no-host-metadata-property': { ruleArguments: [], ruleSeverity: 'error' },
      'no-input-rename': { ruleArguments: [], ruleSeverity: 'error' },
      'no-inputs-metadata-property': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
      'no-output-native': { ruleArguments: [], ruleSeverity: 'error' },
      'no-output-on-prefix': { ruleArguments: [], ruleSeverity: 'error' },
      'no-output-rename': { ruleArguments: [], ruleSeverity: 'error' },
      'no-outputs-metadata-property': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
      'template-banana-in-box': { ruleArguments: [], ruleSeverity: 'error' },
      'template-no-negated-async': { ruleArguments: [], ruleSeverity: 'error' },
      'use-lifecycle-interface': { ruleArguments: [], ruleSeverity: 'error' },
      'use-pipe-transform-interface': {
        ruleArguments: [],
        ruleSeverity: 'error',
      },
    },
  },
};

export const exampleAngularProjectTslintJson = {
  raw: {
    extends: '../../tslint.json',
    rules: {
      'directive-selector': [true, 'attribute', 'angular-app', 'camelCase'],
      'component-selector': [true, 'element', 'angular-app', 'kebab-case'],
    },
    linterOptions: {
      exclude: ['!**/*'],
    },
  },
  tslintPrintConfigResult: {
    rules: {
      'directive-selector': {
        ruleArguments: ['attribute', 'angular-app', 'camelCase'],
        ruleSeverity: 'error',
      },
      'component-selector': {
        ruleArguments: ['element', 'angular-app', 'kebab-case'],
        ruleSeverity: 'error',
      },
    },
  },
};

export const exampleNonAngularProjectTslintJson = {
  raw: {
    extends: '../../tslint.json',
    linterOptions: { exclude: ['!**/*'] },
    rules: {},
  },
  tslintPrintConfigResult: { rules: {} },
};

export const exampleE2eProjectTslintJson = {
  raw: {
    extends: '../../tslint.json',
    linterOptions: { exclude: ['!**/*'] },
    rules: {},
  },
  tslintPrintConfigResult: { rules: {} },
};
