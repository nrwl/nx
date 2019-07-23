import { Tree } from '@angular-devkit/schematics';
import { join } from '@angular-devkit/core';

export function generateProjectLint(
  projectRoot: string,
  tsConfigPath: string,
  linter: 'tslint' | 'eslint' | 'none'
) {
  if (linter === 'tslint') {
    return {
      builder: '@angular-devkit/build-angular:tslint',
      options: {
        tsConfig: [tsConfigPath],
        exclude: ['**/node_modules/**', '!' + projectRoot + '/**']
      }
    };
  } else if (linter === 'eslint') {
    return {};
  } else {
    return undefined;
  }
}

export function addGlobalLint(linter: 'tslint' | 'eslint' | 'none') {
  return (host: Tree) => {
    if (linter === 'tslint') {
      if (!host.exists('/tslint.json')) {
        host.create('/tslint.json', globalTsLint);
      }
    } else if (linter === 'eslint') {
      if (!host.exists('/.eslintrc')) {
        host.create('/.eslintrc', globalTsLint);
      }
    } else {
    }
  };
}

const globalTsLint = `
{
  "rulesDirectory": ["node_modules/@nrwl/workspace/src/tslint"],
  "rules": {
    "arrow-return-shorthand": true,
    "callable-types": true,
    "class-name": true,
    "deprecation": {
      "severity": "warn"
    },
    "forin": true,
    "import-blacklist": [true, "rxjs/Rx"],
    "interface-over-type-literal": true,
    "member-access": false,
    "member-ordering": [
      true,
      {
        "order": [
          "static-field",
          "instance-field",
          "static-method",
          "instance-method"
        ]
      }
    ],
    "no-arg": true,
    "no-bitwise": true,
    "no-console": [true, "debug", "info", "time", "timeEnd", "trace"],
    "no-construct": true,
    "no-debugger": true,
    "no-duplicate-super": true,
    "no-empty": false,
    "no-empty-interface": true,
    "no-eval": true,
    "no-inferrable-types": [true, "ignore-params"],
    "no-misused-new": true,
    "no-non-null-assertion": true,
    "no-shadowed-variable": true,
    "no-string-literal": false,
    "no-string-throw": true,
    "no-switch-case-fall-through": true,
    "no-unnecessary-initializer": true,
    "no-unused-expression": true,
    "no-var-keyword": true,
    "object-literal-sort-keys": false,
    "prefer-const": true,
    "radix": true,
    "triple-equals": [true, "allow-null-check"],
    "unified-signatures": true,
    "variable-name": false,

    "nx-enforce-module-boundaries": [
      true,
      {
        "allow": [],
        "depConstraints": [
          { "sourceTag": "*", "onlyDependOnLibsWithTags": ["*"] }
        ]
      }
    ]
  }
}
`;

const globalEsLit = `
{
}
`;
