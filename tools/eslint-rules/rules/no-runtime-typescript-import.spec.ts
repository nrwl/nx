import { RuleTester } from '@typescript-eslint/rule-tester';
import * as parser from '@typescript-eslint/parser';
import { rule, RULE_NAME } from './no-runtime-typescript-import';

const ruleTester = new RuleTester({
  languageOptions: { parser },
});

ruleTester.run(RULE_NAME, rule, {
  valid: [
    `import type * as ts from 'typescript';`,
    `import type { API } from 'typescript/sync';`,
    `import { type Node, type SourceFile } from 'typescript';`,
    `export type { Node } from 'typescript';`,
    `export { type Node } from 'typescript';`,
    `import type ts = require('typescript');`,
    `let node: import('typescript').Node;`,
    `require.resolve('typescript/package.json');`,
    `require(packageRoot);`,
    `import { workspaceRoot } from '@nx/devkit';`,
    `import tseslint from 'typescript-eslint';`,
    {
      code: `import * as ts from 'typescript';`,
      filename: 'some-file.spec.ts',
    },
  ],
  invalid: [
    `import * as ts from 'typescript';`,
    `import { API } from 'typescript/sync';`,
    `import { type Node, SyntaxKind } from 'typescript';`,
    `import 'typescript';`,
    `import ts = require('typescript');`,
    `const ts = require('typescript');`,
    'const ts = require(`typescript`);',
    `const ts = await import('typescript/ast');`,
    `export { SyntaxKind } from 'typescript';`,
    `export * from 'typescript';`,
  ].map((code) => ({
    code,
    errors: [{ messageId: 'runtimeImport' as const }],
  })),
});
