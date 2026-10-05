import {
  ensureFileExtensions,
  findNextConfigPath,
  getRelativeFilesToCopy,
  getRelativeImports,
  getWithNxContent,
} from './create-next-config-file';
import { stripIndents, workspaceLayout } from '@nx/devkit';
import { readFileSync } from 'node:fs';
import { join } from 'path';
import * as ts from 'typescript';

describe('Next.js config: getWithNxContent', () => {
  it('should swap distDir and getWithNxContext with static values', () => {
    const result = getWithNxContent({
      file: `with-nx.js`,
      content: stripIndents`
      // SHOULD BE LEFT INTACT
      const constants = require("next/constants"); 
      
      // TO BE SWAPPED
      function getWithNxContext() {
        const { workspaceRoot, workspaceLayout } = require('@nx/devkit');
        return {
            workspaceRoot,
            libsDir: workspaceLayout().libsDir,
        };
      }
      
      // SHOULD BE LEFT INTACT
      function withNx(nextConfig = {}, context = getWithNxContext()) {
        return (phase) => {
          if (phase === constants.PHASE_PRODUCTION_SERVER) {
            //...
          } else {
           // ...
          }
        };
      }
      
      // SHOULD BE LEFT INTACT
      module.exports.withNx = withNx;
      `,
    });

    expect(result).toContain(`const constants = require("next/constants")`);
    expect(result).toContain(stripIndents`
      // SHOULD BE LEFT INTACT
      function withNx(nextConfig = {}, context = getWithNxContext()) {
        return (phase) => {
          if (phase === constants.PHASE_PRODUCTION_SERVER) {
            //...
          } else {
           // ...
          }
        };
      }
      
      // SHOULD BE LEFT INTACT
      module.exports.withNx = withNx;
    `);
    expect(result).not.toContain(
      `const { workspaceRoot, workspaceLayout } = require('@nx/devkit');`
    );
    expect(result).toContain(`libsDir: '${workspaceLayout().libsDir}'`);
    expect(result).not.toContain(`libsDir: workspaceLayout().libsDir`);
  });

  it('should return relative module paths used in next.config.js when calling getRelativeFilesToCopy', () => {
    const modulePaths = getRelativeFilesToCopy(
      findNextConfigPath(join(__dirname, 'test-fixtures/config-js')),
      join(__dirname, 'test-fixtures/config-js')
    );

    expect(modulePaths).toEqual([
      'nested/a.cjs',
      'nested/b.cjs',
      'nested.c.cjs',
    ]);
  });

  it('should return relative module paths used in next.config.mjs when calling getRelativeFilesToCopy', () => {
    const modulePaths = getRelativeFilesToCopy(
      findNextConfigPath(join(__dirname, 'test-fixtures/config-mjs')),
      join(__dirname, 'test-fixtures/config-mjs')
    );

    expect(modulePaths).toEqual(['a.mjs']);
  });

  it('should return relative requires when calling getRelativeImports', () => {
    const result = getRelativeImports({
      file: 'next.config.js',
      content: stripIndents`
        const w = require('@scoped/w');
        const x = require('x');
        const y = require("./y");
        const z = require('./nested/z');
      `,
    });

    expect(result).toEqual(['./y', './nested/z']);
  });

  it('should return relative imports when calling getRelativeImports', () => {
    const result = getRelativeImports({
      file: 'next.config.js',
      content: stripIndents`
        import { w } from '@scoped/w';
        import { x } from 'x';
        import { y } from "./y";
        import { z } from './nested/z'
      `,
    });

    expect(result).toEqual(['./y', './nested/z']);
  });

  it('should return files with their extensions when calling ensureFileExtensions', () => {
    const result = ensureFileExtensions(
      ['bar', 'baz', 'foo', 'faz', 'nested/baz.cjs'],
      join(__dirname, 'test-fixtures/ensure-exts')
    );

    expect(result).toEqual([
      'bar.mjs',
      'baz.json',
      'foo.cjs',
      'faz.cjs',
      'nested/baz.cjs',
    ]);
  });

  it('should throw an error if a path cannot be found when calling ensureFileExtensions', () => {
    expect(() =>
      ensureFileExtensions(
        ['not-found'],
        join(__dirname, 'test-fixtures/ensure-exts')
      )
    ).toThrow(/Cannot find file "not-found"/);
  });
});

// `.nx-helpers` is loaded by the built `next.config.js` where only the app's
// production dependencies are installed, so anything copied into it must load
// without build-time packages. `next` is the one dependency it always has.
describe.each([
  ['compose-plugins.ts', join(__dirname, '../../../utils/compose-plugins.ts')],
  ['with-nx.ts', join(__dirname, '../../../../plugins/with-nx.ts')],
])('Next.js config: %s copied into .nx-helpers', (_name, file) => {
  it('should not load anything but next at module scope', () => {
    expect(getModuleScopeImports(file)).toEqual([]);
  });
});

function getModuleScopeImports(file: string): string[] {
  const source = ts.createSourceFile(
    file,
    readFileSync(file).toString(),
    ts.ScriptTarget.Latest,
    true
  );
  const specifiers = source.statements
    .filter(
      (statement): statement is ts.ImportDeclaration =>
        ts.isImportDeclaration(statement) && !isTypeOnly(statement.importClause)
    )
    .map((statement) => (statement.moduleSpecifier as ts.StringLiteral).text);
  collectRequiresOutsideFunctions(source, specifiers);

  return specifiers.filter(
    (specifier) => specifier !== 'next' && !specifier.startsWith('next/')
  );
}

function isTypeOnly(clause: ts.ImportClause | undefined): boolean {
  if (!clause) return false;
  if (clause.isTypeOnly) return true;
  return (
    !clause.name &&
    !!clause.namedBindings &&
    ts.isNamedImports(clause.namedBindings) &&
    clause.namedBindings.elements.every((element) => element.isTypeOnly)
  );
}

function collectRequiresOutsideFunctions(
  node: ts.Node,
  specifiers: string[]
): void {
  node.forEachChild((child) => {
    // A `require` inside a function only runs when that function is called.
    if (ts.isFunctionLike(child)) return;
    if (
      ts.isCallExpression(child) &&
      ts.isIdentifier(child.expression) &&
      child.expression.text === 'require' &&
      ts.isStringLiteral(child.arguments[0])
    ) {
      specifiers.push(child.arguments[0].text);
    }
    collectRequiresOutsideFunctions(child, specifiers);
  });
}
