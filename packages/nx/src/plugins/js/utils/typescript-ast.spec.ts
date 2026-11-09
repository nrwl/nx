import { symlinkSync } from 'fs';
import { dirname, join } from 'path';
import type * as ts from 'typescript';
import { TempFs } from '../../../internal-testing-utils/temp-fs';
import type { TypescriptAst } from './typescript-ast';

// TypeScript 6 parses every fixture the way Nx expects.
const ts6: typeof ts = require('typescript');

const fixtures: Record<string, string> = {
  'bom.ts': `${String.fromCharCode(0xfeff)}// héllo\nimport { a } from "./a";\nexport const x = 1;\n`,
  'next.config.js': [
    "const { withNx } = require('@nx/next');",
    "/** @import { NextConfig } from 'next' */",
    '/** @typedef {{ a: number }} Options */',
    "/** @type {import('@nx/next/plugins/with-nx').WithNxOptions} */",
    'const nextConfig = /** @type {NextConfig} */ ({ nx: {} });',
    '/** @satisfies {Options} */',
    'const options = { a: 1 };',
    '/** @param {string} a @returns {number} */',
    'function size(a) { return a.length; }',
    'module.exports = withNx(nextConfig);',
  ].join('\n'),
  'component.jsx':
    'export const A = ({ x }) => <div className="a">{x}</div>;\n',
  'shapes.ts': [
    'interface Props { onClick(): void; label?: string; render: (x: number) => string; new (): Props; [key: string]: unknown; readonly r: 1; }',
    'export class A extends React.Component<Props> { constructor(private readonly p: Props) { super(p); } get g() { return 1; } set g(v) {} static s = 1; #priv = 2; m?(): void; }',
    'abstract class B<T extends object = {}> { abstract a(): T; }',
    'const b = <T,>(v: T) => v;',
    'const c = <string>(<unknown>b);',
    'const d = c as string satisfies string;',
    'export default function f(this: unknown, ...rest: number[]) { return rest; }',
    'namespace N { export const z = 1; }',
    'declare module "m" { export const y: number; }',
    'import x = require("x");',
    'import type { T1 } from "t";',
    'import def, * as ns from "ns";',
    'export * as all from "all";',
    'export { b as bee };',
    'label: for (const q of []) { break label; }',
    'for (let i = 0, j = 1; i < j; i++) {} for (const k in {}) {} while (false) {} do {} while (false);',
    'enum E { A = 1, B = A << 1, C = "c" }',
    'type Cond<T> = T extends string ? `x${T}` : never; type Mapped = { [K in keyof Props]?: Props[K] };',
    'const o = { a, ...rest2, [k]: 1, "s": 2, 3: 3, m() {}, get g() { return 1; } };',
    'const arr = [1, ...xs]; const { p1, p2: { p3 } = {} } = o; const [e1, e2 = 1] = arr;',
    'const t = obj?.a?.[0]?.(1)!; const tpl = `a${1}b${2}c`; const re = /x/g; const big = 10n;',
    'async function* gen() { yield* other(); await p; } const cls = class {}; new Foo<string>(1);',
    'switch (v) { case 1: break; default: } try { throw new Error(); } catch { } finally { }',
    'if (a) b(); else { c(); } const fnExpr = function named() {}; void 0; typeof x; delete o.a; !a; -a; a++;',
    '@dec() class Decorated { @prop() p: string; method(@param() a: string) {} }',
    'let u: string | number & {} = 1; let tup: [a: string, b?: number, ...c: boolean[]]; let fnT: new () => void;',
    'let q: typeof import("x"); let kt: keyof typeof o; let idx: Props["label"]; let lit: "a" | 1 | true | null;',
  ].join('\n'),
  'view.tsx':
    'export const V = <T,>({ a }: { a: T }) => (<><div key="k" {...rest} on={() => a}>{a} text</div><Comp.Sub x={1} /></>);\n',
};

describe('getTypescriptAst', () => {
  let fs: TempFs;

  beforeEach(() => {
    fs = new TempFs('typescript-ast');
    fs.createDirSync('node_modules');
  });

  afterEach(() => {
    fs.cleanup();
  });

  async function loadWithTypescript(packageName: string) {
    symlinkSync(
      dirname(require.resolve(`${packageName}/package.json`)),
      join(fs.tempDir, 'node_modules/typescript'),
      'dir'
    );
    vi.resetModules();
    (await import('../../../utils/workspace-root')).setWorkspaceRoot(
      fs.tempDir
    );
    const { getTypescriptBackend } = await import('./typescript-backend');
    const { getTypescriptAst } = await import('./typescript-ast');
    return { backend: getTypescriptBackend(), ast: getTypescriptAst() };
  }

  it('should return the TypeScript module before TypeScript 7', async () => {
    const { backend, ast } = await loadWithTypescript('typescript');

    expect(backend.kind).toBe('classic');
    expect(ast).toBe(backend.kind === 'classic' && backend.ts);
  });

  it.each(['typescript', '@typescript/native'])(
    'should report syntax errors with %s',
    async (packageName) => {
      const { ast } = await loadWithTypescript(packageName);
      const { hasParseErrors } = await import('./typescript-ast');
      const parse = (fileName: string, text: string) =>
        hasParseErrors(
          ast.createSourceFile(fileName, text, ast.ScriptTarget.Latest, true)
        );

      expect(
        parse('valid.tsx', 'export const A = () => <div><b /></div>;')
      ).toBe(false);
      expect(parse('call.ts', 'foo(1;')).toBe(true);
      // TypeScript 7.1 marks no node for an unclosed JSX element.
      expect(
        parse('unclosed.tsx', 'export const A = () => <div><b></div>;')
      ).toBe(true);
    }
  );

  describe('with TypeScript 7.1', () => {
    let ast: TypescriptAst;

    beforeEach(async () => {
      let backend: { kind: string };
      ({ backend, ast } = await loadWithTypescript('@typescript/native'));
      expect(backend.kind).toBe('api');
    });

    it.each(Object.keys(fixtures))(
      'should parse %s into the tree TypeScript 6 produces',
      (fileName) => {
        const text = fixtures[fileName];

        const sourceFile = ast.createSourceFile(
          fileName,
          text,
          ast.ScriptTarget.Latest,
          true
        );

        expect(sourceFile.text).toBe(text);
        expect(describeTree(ast, sourceFile)).toEqual(
          describeTree(
            ts6,
            ts6.createSourceFile(fileName, text, ts6.ScriptTarget.Latest, true)
          )
        );
      }
    );

    it('should parse a file without a name as TypeScript', () => {
      const text = 'const a = <string>b;';

      const sourceFile = ast.createSourceFile(
        '',
        text,
        ast.ScriptTarget.Latest,
        true
      );

      expect(describeTree(ast, sourceFile)).toEqual(
        describeTree(
          ts6,
          ts6.createSourceFile('', text, ts6.ScriptTarget.Latest, true)
        )
      );
    });

    it('should answer every node guard as TypeScript 6 does', () => {
      const guards = Object.keys(ast).filter(
        (name) => name.startsWith('is') && name in ts6
      );

      for (const [fileName, text] of Object.entries(fixtures)) {
        const nodes = collectNodes(
          ast,
          ast.createSourceFile(fileName, text, ast.ScriptTarget.Latest, true)
        );
        const ts6Nodes = collectNodes(
          ts6,
          ts6.createSourceFile(fileName, text, ts6.ScriptTarget.Latest, true)
        );

        const answers = (module: object, list: ts.Node[]) =>
          guards.flatMap((guard) =>
            list.map((node) => `${guard} ${node.pos} ${module[guard](node)}`)
          );
        expect(answers(ast, nodes)).toEqual(answers(ts6, ts6Nodes));
      }
    });

    it('should report the modifiers TypeScript 6 reports', () => {
      const modifiers = (
        module: Pick<
          typeof ts,
          'canHaveModifiers' | 'forEachChild' | 'getModifiers' | 'SyntaxKind'
        >,
        sourceFile: ts.SourceFile
      ) =>
        collectNodes(module, sourceFile).map(
          (node) =>
            `${node.pos} ${module.canHaveModifiers(node)} ${module
              .getModifiers(node as ts.HasModifiers)
              ?.map((modifier) => kindName(module.SyntaxKind, modifier.kind))}`
        );

      for (const [fileName, text] of Object.entries(fixtures)) {
        expect(
          modifiers(
            ast,
            ast.createSourceFile(fileName, text, ast.ScriptTarget.Latest, true)
          )
        ).toEqual(
          modifiers(
            ts6,
            ts6.createSourceFile(fileName, text, ts6.ScriptTarget.Latest, true)
          )
        );
      }
    });

    it('should scan the tokens TypeScript 6 scans', () => {
      const tokens = (
        module: Pick<
          typeof ts,
          'LanguageVariant' | 'ScriptTarget' | 'SyntaxKind'
        > & { createScanner: TypescriptAst['createScanner'] },
        fileName: string,
        text: string,
        start: number,
        length: number
      ) => {
        const scanner = module.createScanner(
          module.ScriptTarget.Latest,
          true,
          fileName.endsWith('x')
            ? module.LanguageVariant.JSX
            : module.LanguageVariant.Standard,
          text,
          undefined,
          start,
          length
        );
        const result: string[] = [];
        let token: string;
        while (
          (token = kindName(module.SyntaxKind, scanner.scan())) !==
          'EndOfFileToken'
        ) {
          result.push(
            `${token} ${scanner.getTokenStart()}-${scanner.getTokenEnd()}`
          );
        }
        return result;
      };

      for (const [fileName, text] of Object.entries(fixtures)) {
        const third = Math.floor(text.length / 3);
        for (const [start, length] of [
          [0, text.length],
          [third, third],
        ]) {
          expect(tokens(ast, fileName, text, start, length)).toEqual(
            tokens(ts6, fileName, text, start, length)
          );
        }
      }
    });

    it('should stop forEachChild at the first truthy callback result', () => {
      const sourceFile = ast.createSourceFile(
        'a.ts',
        'const a = 1;\nconst b = 2;\n',
        ast.ScriptTarget.Latest,
        true
      );
      const visited: number[] = [];

      const found = ast.forEachChild(sourceFile, (node) => {
        visited.push(node.pos);
        return ast.isVariableStatement(node) ? node : undefined;
      });

      expect(found?.getText()).toBe('const a = 1;');
      expect(visited).toEqual([0]);
    });
  });
});

function collectNodes(
  ast: { forEachChild: typeof ts.forEachChild },
  root: ts.Node
) {
  const nodes: ts.Node[] = [];
  const visit = (node: ts.Node) => {
    nodes.push(node);
    ast.forEachChild(node, (child) => {
      visit(child);
    });
  };
  visit(root);
  return nodes;
}

function describeTree(
  ast: Pick<typeof ts, 'forEachChild' | 'SyntaxKind'>,
  sourceFile: ts.SourceFile
) {
  return collectNodes(ast, sourceFile).map(
    (node) =>
      `${kindName(ast.SyntaxKind, node.kind)} ${node.getStart()}-${node.end} ${node.getText()}`
  );
}

// A kind's name without the `First*`/`Last*` markers, which differ between
// TypeScript versions.
function kindName(syntaxKind: object, kind: number) {
  const name = Object.keys(syntaxKind).find(
    (key) => syntaxKind[key] === kind && !/^(First|Last)[A-Z]/.test(key)
  );
  return name === 'EndOfFile' ? 'EndOfFileToken' : name;
}
