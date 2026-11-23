import { symlinkSync } from 'fs';
import { dirname, join } from 'path';
import type * as ts from 'typescript';
import { TempFs } from '../../../internal-testing-utils/temp-fs';
import type { PrintListFormat, TypescriptAst } from './typescript-ast';

type Adapter = typeof import('./typescript-ast');
type Factory = TypescriptAst['factory'];

interface Toolkit {
  ast: TypescriptAst;
  f: Factory;
  adapter: Adapter;
  parse(text: string, fileName?: string): ts.SourceFile;
  find<T extends ts.Node>(root: ts.Node, kind: string, index?: number): T;
  // `new` with a built callee: no generator builds one, so `factory` lacks it.
  newExpression(callee: ts.Expression, args: ts.Expression[]): ts.Node;
}

interface UpdateRow {
  name: string;
  source: string;
  // Returns the node to replace and what replaces it.
  edit(t: Toolkit, sourceFile: ts.SourceFile): [ts.Node, ts.Node];
  // The whole file after the edit.
  expected?: string;
  throws?: RegExp;
}

type Edit = UpdateRow['edit'];

const arrayEdit =
  (change: (elements: ts.Expression[], t: Toolkit) => ts.Expression[]): Edit =>
  (t, sourceFile) => {
    const array = t.find<ts.ArrayLiteralExpression>(
      sourceFile,
      'ArrayLiteralExpression'
    );
    return [
      array,
      t.f.updateArrayLiteralExpression(array, change([...array.elements], t)),
    ];
  };
const objectEdit =
  (
    change: (
      properties: ts.ObjectLiteralElementLike[],
      t: Toolkit
    ) => ts.ObjectLiteralElementLike[]
  ): Edit =>
  (t, sourceFile) => {
    const object = t.find<ts.ObjectLiteralExpression>(
      sourceFile,
      'ObjectLiteralExpression'
    );
    return [
      object,
      t.f.updateObjectLiteralExpression(
        object,
        change([...object.properties], t)
      ),
    ];
  };
const callEdit =
  (change: (args: ts.Expression[], t: Toolkit) => ts.Expression[]): Edit =>
  (t, sourceFile) => {
    const call = t.find<ts.CallExpression>(sourceFile, 'CallExpression');
    return [
      call,
      t.f.updateCallExpression(
        call,
        call.expression,
        call.typeArguments,
        change([...call.arguments], t)
      ),
    ];
  };
const importsEdit =
  (
    change: (elements: ts.ImportSpecifier[], t: Toolkit) => ts.ImportSpecifier[]
  ): Edit =>
  (t, sourceFile) => {
    const imports = t.find<ts.NamedImports>(sourceFile, 'NamedImports');
    return [
      imports,
      t.f.updateNamedImports(imports, change([...imports.elements], t)),
    ];
  };
const recreatedCall =
  (change: (args: ts.Expression[], t: Toolkit) => ts.Expression[]): Edit =>
  (t, sourceFile) => {
    const call = t.find<ts.CallExpression>(sourceFile, 'CallExpression');
    return [
      call,
      t.f.createCallExpression(
        call.expression,
        undefined,
        change([...call.arguments], t)
      ),
    ];
  };

const id = (t: Toolkit, text: string) => t.f.createIdentifier(text);
const property = (t: Toolkit, name: string, value: ts.Expression) =>
  t.f.createPropertyAssignment(name, value);
const multiLineObject = (t: Toolkit) =>
  t.f.createObjectLiteralExpression(
    [property(t, 'k', t.f.createNumericLiteral(1))],
    true
  );
const specifier = (t: Toolkit, text: string) =>
  t.f.createImportSpecifier(false, undefined, id(t, text));
const comment = <T extends ts.Node>(t: Toolkit, node: T, text: string): T =>
  t.adapter.addSyntheticLeadingComment(
    node,
    t.ast.SyntaxKind.SingleLineCommentTrivia,
    text,
    true
  );
const constStatement = (t: Toolkit, name: string, value: ts.Expression) =>
  t.f.createVariableStatement(
    undefined,
    t.f.createVariableDeclarationList(
      [t.f.createVariableDeclaration(name, undefined, undefined, value)],
      t.ast.NodeFlags.Const
    )
  );

const updateRows: UpdateRow[] = [
  {
    name: 'inline list: append, prepend and insert',
    source: 'const a = [x, y];\n',
    edit: arrayEdit(([x, y], t) => [id(t, 'p'), x, id(t, 'm'), y, id(t, 'z')]),
    expected: 'const a = [p, x, m, y, z];\n',
  },
  {
    name: 'inline list: remove the first and the last element',
    source: 'const a = [x, y, z];\n',
    edit: arrayEdit(([, y]) => [y]),
    expected: 'const a = [y];\n',
  },
  {
    name: 'inline list: gaps between kept elements stay as written',
    source: 'const a = [x ,y,   z  ];\n',
    edit: arrayEdit((elements, t) => [...elements, id(t, 'n')]),
    expected: 'const a = [x ,y,   z, n  ];\n',
  },
  {
    name: 'inline object: append keeps the padding',
    source: 'const o = { a: 1 };\n',
    edit: objectEdit((properties, t) => [
      ...properties,
      property(t, 'b', t.f.createNumericLiteral(2)),
    ]),
    expected: 'const o = { a: 1, b: 2 };\n',
  },
  {
    name: 'one per line: append and prepend without a trailing comma',
    source: 'const a = [\n  x,\n  y\n];\n',
    edit: arrayEdit((elements, t) => [id(t, 'p'), ...elements, id(t, 'z')]),
    expected: 'const a = [\n  p,\n  x,\n  y,\n  z\n];\n',
  },
  {
    name: 'one per line: insert keeps the blank line of the later element',
    source: 'const a = [\n  x,\n\n  y,\n];\n',
    edit: arrayEdit(([x, y], t) => [x, id(t, 'z'), y]),
    expected: 'const a = [\n  x,\n  z,\n\n  y,\n];\n',
  },
  {
    name: 'one per line: a multi-line built element takes the list indentation and the CRLF of the file',
    source: 'function g() {\r\n    return [\r\n        x,\r\n    ];\r\n}\r\n',
    edit: arrayEdit((elements, t) => [...elements, multiLineObject(t)]),
    expected:
      'function g() {\r\n    return [\r\n        x,\r\n        {\r\n            k: 1\r\n        },\r\n    ];\r\n}\r\n',
  },
  {
    name: 'comma-first: append and remove',
    source: 'const a = [\n    x\n  , y // ty\n  , z\n];\n',
    edit: arrayEdit(([x, , z], t) => [x, z, id(t, 'n')]),
    expected: 'const a = [\n    x\n  , z, n\n];\n',
  },
  {
    name: 'comma-first: comments around the separator stay',
    source: 'const a = [a\n/*before*/ , //after\nb];\n',
    edit: arrayEdit((elements, t) => [...elements, id(t, 'z')]),
    expected: 'const a = [a\n/*before*/ , //after\nb,\nz];\n',
  },
  {
    name: 'comma on its own line: prepend',
    source: 'foo(\n  x\n  ,\n  y\n);\n',
    edit: callEdit((args, t) => [id(t, 'z'), ...args]),
    expected: 'foo(\n  z,\n  x\n  ,\n  y\n);\n',
  },
  {
    name: 'trailing comma on its own line with a comment: remove all',
    source: 'foo(\n  x\n  , // c\n);\n',
    edit: callEdit(() => []),
    expected: 'foo();\n',
  },
  {
    name: 'array hole: a prepend adds no hole when the comma is on the next line',
    source: 'const b = [\n  x,\n  ,\n];\n',
    edit: arrayEdit((elements, t) => [id(t, 'z'), ...elements]),
    expected: 'const b = [\n  z,\n  x,\n  ,\n];\n',
  },
  {
    name: 'array hole: removing what follows it keeps its separator',
    source: 'const a = [x,,y];\n',
    edit: arrayEdit(([x, hole]) => [x, hole]),
    expected: 'const a = [x,,];\n',
  },
  {
    name: 'empty inline list: object gets padding',
    source: 'const o = {};\n',
    edit: objectEdit((_, t) => [property(t, 'b', t.f.createNumericLiteral(2))]),
    expected: 'const o = { b: 2 };\n',
  },
  {
    name: 'empty inline array re-created as multi-line prints one element per line',
    source: 'const eslintConfig = [];\n',
    edit: (t, sourceFile) => [
      t.find(sourceFile, 'ArrayLiteralExpression'),
      t.f.createArrayLiteralExpression([id(t, 'x'), multiLineObject(t)], true),
    ],
    expected:
      'const eslintConfig = [\n    x,\n    {\n        k: 1\n    }\n];\n',
  },
  {
    name: 'empty multi-line list',
    source: '  const a = [\n  ];\n',
    edit: arrayEdit((_, t) => [id(t, 'z')]),
    expected: '  const a = [\n      z\n  ];\n',
  },
  {
    name: 'empty list holding a comment with a line break',
    source: 'const a = [/* line1\n line2 */];\n',
    edit: arrayEdit((_, t) => [id(t, 'z')]),
    expected: 'const a = [/* line1\n line2 */\n    z\n ];\n',
  },
  {
    name: 'remove all: a // comment on the opener line does not swallow the closer',
    source: 'const a = [ // why\n  x ];\n',
    edit: arrayEdit(() => []),
    expected: 'const a = [ // why\n   ];\n',
  },
  {
    name: 'hugging call: append stays on the line',
    source: 'foo(a, {\n  k: 1,\n});\n',
    edit: callEdit((args, t) => [...args, id(t, 'z')]),
    expected: 'foo(a, {\n  k: 1,\n}, z);\n',
  },
  {
    name: 'import specifiers: add and remove',
    source: "import {\n  a, // ta\n  b,\n} from 'm';\n",
    edit: importsEdit(([, b], t) => [b, specifier(t, 'c')]),
    expected: "import {\n  b,\n  c,\n} from 'm';\n",
  },
  {
    name: 'update in place: an element updated after a removed sibling, arguments moved from that sibling',
    source:
      'const providers = [\n  // routing\n  provideServerRouting(routes, withAppShell(Shell)),\n  // rendering\n  provideServerRendering(), // tr\n];\n',
    edit: arrayEdit(([routing, rendering], t) => {
      const [routes, ...rest] = (routing as ts.CallExpression).arguments;
      return [
        t.f.updateCallExpression(
          rendering as ts.CallExpression,
          (rendering as ts.CallExpression).expression,
          undefined,
          [
            t.f.createCallExpression(id(t, 'withRoutes'), undefined, [routes]),
            ...rest,
          ]
        ),
      ];
    }),
    expected:
      'const providers = [\n  // rendering\n  provideServerRendering(withRoutes(routes), withAppShell(Shell)), // tr\n];\n',
  },
  {
    name: 'update in place: a call whose object argument is updated',
    source:
      "RouterModule.forRoot(routes /* r */, {\n  // keep\n  useHash: true,\n  initialNavigation: 'disabled',\n});\n",
    edit: callEdit(([routes, options], t) => [
      routes,
      t.f.updateObjectLiteralExpression(options as ts.ObjectLiteralExpression, [
        (options as ts.ObjectLiteralExpression).properties[0],
        property(
          t,
          'initialNavigation',
          t.f.createStringLiteral('enabledBlocking', true)
        ),
      ]),
    ]),
    expected:
      "RouterModule.forRoot(routes /* r */, {\n  // keep\n  useHash: true,\n  initialNavigation: 'enabledBlocking',\n});\n",
  },
  {
    name: 'update in place: an object that lost every property keeps the comments around it',
    source:
      "Cypress.SelectorPlayground.defaults(\n  // playground options\n  {\n    // drop the element hook\n    onElement: ($el) => $el.attr('id'), // trailing\n  } /* after obj */\n);\n",
    edit: callEdit(([options, ...rest], t) => [
      t.f.updateObjectLiteralExpression(
        options as ts.ObjectLiteralExpression,
        []
      ),
      ...rest,
    ]),
    expected:
      'Cypress.SelectorPlayground.defaults(\n  // playground options\n  {} /* after obj */\n);\n',
  },
  {
    name: 'a built call in the place of a removed call does not take its comments',
    source:
      'provideRouter(\n  routes,\n  // old\n  withDisabledInitialNavigation(), // t\n);\n',
    edit: callEdit(([routes], t) => [
      routes,
      t.f.createCallExpression(id(t, 'withNew'), undefined, []),
    ]),
    expected: 'provideRouter(\n  routes,\n  withNew(),\n);\n',
  },
  {
    name: 'move: an element of another list, first and last',
    source: 'const a = [x];\nconst o = [p /* cp */, q];\n',
    edit: arrayEdit((elements, t) => {
      const other = t.find<ts.ArrayLiteralExpression>(
        elements[0].getSourceFile(),
        'ArrayLiteralExpression',
        1
      );
      return [other.elements[0], ...elements, other.elements[1]];
    }),
    expected: 'const a = [p /* cp */, x, q];\nconst o = [p /* cp */, q];\n',
  },
  {
    name: 'move: into a built call, with the comments of the element',
    source: 'const a = [\n  // about x\n  x, // tx\n  y,\n];\n',
    edit: arrayEdit(([x, y], t) => [
      t.f.createCallExpression(id(t, 'wrap'), undefined, [x, id(t, 'n')]),
      y,
    ]),
    expected: 'const a = [\n  wrap(// about x\n  x, // tx\n n),\n  y,\n];\n',
  },
  {
    name: 'variable statement under a case clause replaced by a built one holding an update of an object from an IIFE',
    source:
      'switch (k) {\n  case 1:\n    const options = (() => ({\n      // entry\n      a: 1, // ta\n      b: 2,\n    }))();\n    break;\n}\n',
    edit: (t, sourceFile) => {
      const options = t.find<ts.ObjectLiteralExpression>(
        sourceFile,
        'ObjectLiteralExpression'
      );
      return [
        t.find(sourceFile, 'VariableStatement'),
        constStatement(
          t,
          'configValues',
          t.f.createObjectLiteralExpression([
            property(
              t,
              'build',
              t.f.updateObjectLiteralExpression(options, [
                ...options.properties,
                property(t, 'extra', t.f.createTrue()),
              ])
            ),
          ])
        ),
      ];
    },
    expected:
      'switch (k) {\n  case 1:\n    const configValues = { build: {\n      // entry\n      a: 1, // ta\n      b: 2,\n      extra: true,\n    } };\n    break;\n}\n',
  },
  {
    name: 'comments: a removed element takes its own, also the one after its separator',
    source:
      'const a = [\n  // about x\n  x, // tx\n  // about y\n  y, // ty\n  z,\n];\n',
    edit: arrayEdit(([x, , z]) => [x, z]),
    expected: 'const a = [\n  // about x\n  x, // tx\n  z,\n];\n',
  },
  {
    name: 'comments: a new separator goes before a // comment',
    source: 'const a = [\n  x,\n  y // ty\n];\n',
    edit: arrayEdit((elements, t) => [...elements, id(t, 'z')]),
    expected: 'const a = [\n  x,\n  y, // ty\n  z\n];\n',
  },
  {
    name: 'comments: nothing follows a // comment on its line',
    source: 'const a = [x, y // ty\n];\n',
    edit: arrayEdit((elements, t) => [...elements, id(t, 'z')]),
    expected: 'const a = [x, y, // ty\n z\n];\n',
  },
  {
    name: 'comments: a block comment after the separator belongs to the next element',
    source: 'const a = [x, /* see http://x, y */ y];\n',
    edit: arrayEdit(([, y]) => [y]),
    expected: 'const a = [/* see http://x, y */ y];\n',
  },
  {
    name: 'comments: those on the opener line and before the closer stay with the list',
    source: 'const a = [ // the list\n  x,\n  y,\n  // more below\n];\n',
    edit: arrayEdit(([, y], t) => [y, id(t, 'z')]),
    expected: 'const a = [ // the list\n  y,\n  z,\n  // more below\n];\n',
  },
  {
    name: 'comments: one followed by a blank line stays when the first element goes',
    source:
      'const a = [\n  // section header\n\n  // about x\n  x,\n  y,\n];\n',
    edit: arrayEdit(([, y]) => [y]),
    expected: 'const a = [\n  // section header\n\n  y,\n];\n',
  },
  {
    name: 'comments: whitespace TypeScript accepts does not hide one',
    source: 'const a = [x \u200b/* cx */, y];\n',
    edit: arrayEdit(([x]) => [x]),
    expected: 'const a = [x \u200b/* cx */];\n',
  },
  {
    name: 'new without arguments gains them',
    source: 'const p = [new Plugin, new Typed<T>];\n',
    edit: arrayEdit((elements, t) =>
      elements.map((node) =>
        t.f.updateNewExpression(
          node as ts.NewExpression,
          (node as ts.NewExpression).expression,
          (node as ts.NewExpression).typeArguments,
          [id(t, 'options')]
        )
      )
    ),
    expected: 'const p = [new Plugin(options), new Typed<T>(options)];\n',
  },
  {
    name: 'new loses its type arguments, the trivia before them stays',
    source: 'new X/*c*/< Options >({\n  a: 1,\n});\n',
    edit: (t, sourceFile) => {
      const node = t.find<ts.NewExpression>(sourceFile, 'NewExpression');
      return [
        node,
        t.f.updateNewExpression(node, node.expression, undefined, [
          id(t, 'buildOptions'),
        ]),
      ];
    },
    expected: 'new X/*c*/(buildOptions);\n',
  },
  {
    name: 'module specifier replaced by a built string',
    source: "import { mount } from 'cypress/angular'; // keep\n",
    edit: (t, sourceFile) => {
      const declaration = sourceFile.statements[0] as ts.ImportDeclaration;
      return [
        declaration,
        t.f.updateImportDeclaration(
          declaration,
          declaration.modifiers,
          declaration.importClause,
          t.f.createStringLiteral('@cypress/angular', true),
          declaration.attributes
        ),
      ];
    },
    expected: "import { mount } from '@cypress/angular'; // keep\n",
  },
  {
    name: 'element moved out of an async function to the top level of a module',
    source:
      'export {};\nconst a = [x];\nasync function f() {\n  return [await g()];\n}\n',
    edit: (t, sourceFile) => {
      const [target, inner] = [0, 1].map((index) =>
        t.find<ts.ArrayLiteralExpression>(
          sourceFile,
          'ArrayLiteralExpression',
          index
        )
      );
      return [
        target,
        t.f.updateArrayLiteralExpression(target, [
          ...target.elements,
          inner.elements[0],
        ]),
      ];
    },
    expected:
      'export {};\nconst a = [x, await g()];\nasync function f() {\n  return [await g()];\n}\n',
  },
  {
    name: 'built: data as eslint writes it, with negative numbers and a numeric key',
    source: 'export default [base];\n',
    edit: arrayEdit((elements, t) => [
      ...elements,
      t.f.createObjectLiteralExpression(
        [
          t.f.createPropertyAssignment(
            t.f.createStringLiteral('a-b'),
            t.f.createArrayLiteralExpression([
              t.f.createStringLiteral('error'),
              t.f.createPrefixUnaryExpression(
                t.ast.SyntaxKind.MinusToken,
                t.f.createNumericLiteral(1)
              ),
              t.f.createNumericLiteral(1e21),
              t.f.createFalse(),
              t.f.createNull(),
            ])
          ),
          property(t, '0', id(t, 'x')),
        ],
        true
      ),
    ]),
    expected:
      'export default [base, {\n    "a-b": ["error", -1, 1e+21, false, null],\n    0: x\n}];\n',
  },
  {
    name: 'built: spreads, calls, accesses, await import and (config) => ({...})',
    source: 'export default [\n  base,\n];\n',
    edit: arrayEdit((elements, t) => {
      const f = t.f;
      const access = (base: ts.Expression, name: string) =>
        f.createPropertyAccessExpression(base, name);
      return [
        f.createSpreadElement(
          f.createElementAccessExpression(
            access(id(t, 'nx'), 'configs'),
            f.createStringLiteral('x')
          )
        ),
        ...elements,
        f.createObjectLiteralExpression([
          property(
            t,
            'parser',
            f.createAwaitExpression(
              f.createCallExpression(id(t, 'import'), undefined, [
                f.createStringLiteral('p'),
              ])
            )
          ),
          property(
            t,
            'dir',
            access(
              f.createMetaProperty(
                t.ast.SyntaxKind.ImportKeyword,
                id(t, 'meta')
              ),
              'dirname'
            )
          ),
        ]),
        f.createSpreadElement(
          f.createCallExpression(
            access(
              f.createCallExpression(
                access(id(t, 'compat'), 'config'),
                undefined,
                []
              ),
              'map'
            ),
            undefined,
            [
              f.createArrowFunction(
                undefined,
                undefined,
                [f.createParameterDeclaration(undefined, undefined, 'config')],
                undefined,
                f.createToken(t.ast.SyntaxKind.EqualsGreaterThanToken),
                f.createParenthesizedExpression(
                  f.createObjectLiteralExpression([
                    f.createSpreadAssignment(id(t, 'config')),
                    property(
                      t,
                      'rules',
                      f.createObjectLiteralExpression([
                        f.createSpreadAssignment(id(t, 'config.rules')),
                      ])
                    ),
                  ])
                )
              ),
            ]
          )
        ),
      ];
    }),
    expected:
      'export default [\n  ...nx.configs["x"],\n  base,\n  { parser: await import("p"), dir: import.meta.dirname },\n  ...compat.config().map(config => ({ ...config, rules: { ...config.rules } })),\n];\n',
  },
  {
    name: 'built: an import specifier whose name holds a whole specifier',
    source:
      "import { type ServerRoute, RenderMode as Mode, provideServerRouting } from '@angular/ssr';\n",
    edit: importsEdit((_, t) =>
      ['type ServerRoute', 'RenderMode as Mode', 'withRoutes'].map((text) =>
        specifier(t, text)
      )
    ),
    expected:
      "import { type ServerRoute, RenderMode as Mode, withRoutes } from '@angular/ssr';\n",
  },
  {
    name: 'built: leading comments above their property',
    source: 'const a = [\n  x,\n];\n',
    edit: arrayEdit((elements, t) => {
      const project = property(t, 'project', t.f.createNull());
      comment(t, project, ' first');
      comment(t, project, ' second');
      return [
        ...elements,
        t.f.createObjectLiteralExpression(
          [
            comment(
              t,
              property(t, 'rules', t.f.createObjectLiteralExpression([])),
              ' Override or add rules here'
            ),
            project,
          ],
          true
        ),
      ];
    }),
    expected:
      'const a = [\n  x,\n  {\n      // Override or add rules here\n      rules: {},\n      // first\n      // second\n      project: null\n  },\n];\n',
  },
  {
    name: 'throws: a slot that cannot change',
    source: 'foo(x);\n',
    edit: (t, sourceFile) => {
      const call = t.find<ts.CallExpression>(sourceFile, 'CallExpression');
      return [
        call,
        t.f.updateCallExpression(call, id(t, 'bar'), undefined, [
          ...call.arguments,
        ]),
      ];
    },
    throws: /^Unsupported node update: change of CallExpression\.expression$/,
  },
  {
    name: 'throws: a built kind no generator builds',
    source: 'const a = [x];\n',
    edit: arrayEdit((elements, t) => [
      ...elements,
      t.f.createBinaryExpression(
        id(t, 'p'),
        t.ast.SyntaxKind.BarBarToken,
        id(t, 'q')
      ),
    ]),
    throws: /built BinaryExpression in ArrayLiteralExpression\.elements$/,
  },
  {
    name: 'throws: a property name that is not an identifier',
    source: 'const a = [x];\n',
    edit: arrayEdit((elements, t) => [
      ...elements,
      t.f.createObjectLiteralExpression([
        property(t, 'dev.local', t.f.createObjectLiteralExpression([])),
      ]),
    ]),
    throws: /built identifier with the text dev\.local in PropertyAssignment$/,
  },
  {
    name: 'throws: import specifier text that is not one specifier',
    source: "import { a } from 'm';\n",
    edit: importsEdit((_, t) => [specifier(t, 'x as default')]),
    throws: /built import specifier x as default in NamedImports\.elements$/,
  },
  {
    name: 'throws: elements reordered',
    source: 'const a = [x, y];\n',
    edit: arrayEdit(([x, y]) => [y, x]),
    throws:
      /elements of ArrayLiteralExpression\.elements reordered or repeated$/,
  },
  {
    name: 'throws: a call in an optional chain re-created as a plain call',
    source: 'RouterModule.forRoot?.(routes);\n',
    edit: recreatedCall((args) => args),
    throws: /change of the optional chain state of a CallExpression$/,
  },
  {
    name: 'throws: arguments added under new new A',
    source: 'const p = new new A;\n',
    edit: (t, sourceFile) => {
      const node = t.find<ts.NewExpression>(sourceFile, 'NewExpression');
      return [
        node,
        t.f.updateNewExpression(node, node.expression, undefined, [id(t, 'a')]),
      ];
    },
    // TypeScript 6's factory puts the inner `new` in parentheses first.
    throws:
      /(NewExpression\.arguments added to a NewExpression whose callee is a NewExpression without arguments|change of NewExpression\.expression)$/,
  },
  {
    name: 'throws: array hole moved out of its array',
    source: 'const a = [x, , y];\nfoo(z);\n',
    edit: callEdit((args, t) => [
      t.find<ts.ArrayLiteralExpression>(
        args[0].getSourceFile(),
        'ArrayLiteralExpression'
      ).elements[1],
      ...args,
    ]),
    throws: /array hole moved into CallExpression\.arguments$/,
  },
  {
    name: 'throws: element moved from another file',
    source: 'const a = [x];\n',
    edit: arrayEdit((elements, t) => [
      ...elements,
      t.find<ts.ArrayLiteralExpression>(
        t.parse('const b = [y];\n', 'other.ts'),
        'ArrayLiteralExpression'
      ).elements[0],
    ]),
    throws:
      /Identifier moved into ArrayLiteralExpression\.elements from another file$/,
  },
  {
    name: 'throws: the same built node in a list with parsed elements and elsewhere',
    source: 'const a = [x];\n',
    edit: arrayEdit(([x], t) => {
      const shared = id(t, 'n');
      return [
        t.f.createObjectLiteralExpression([
          property(t, 'k', shared),
          property(
            t,
            'c',
            t.f.createCallExpression(id(t, 'f'), undefined, [shared, x])
          ),
        ]),
      ];
    }),
    throws: /the built node holds the same Identifier twice$/,
  },
  {
    name: 'throws: leading comment on a node that is not an element of a built multi-line literal',
    source: 'const a = [x];\n',
    edit: arrayEdit((elements, t) => [
      ...elements,
      comment(t, t.f.createObjectLiteralExpression([], true), ' c'),
    ]),
    throws:
      /a leading comment on a built node that is not an element of a built object or array literal printed one element per line$/,
  },
  {
    name: 'throws: the output does not parse',
    source: 'a;\nconst b = [x];\n',
    edit: arrayEdit((elements, t) => [...elements, id(t, 'class')]),
    throws:
      /the printed output does not parse \(ArrayLiteralExpression at line 2\)$/,
  },
];

interface BuiltRow {
  name: string;
  print(t: Toolkit): string;
  expected: string;
}

const builtRows: BuiltRow[] = [
  {
    name: 'printNode: leading comments above their property and array element',
    print: (t) =>
      t.adapter.printNode(
        t.f.createObjectLiteralExpression(
          [
            comment(
              t,
              property(
                t,
                'a',
                t.f.createArrayLiteralExpression(
                  [
                    t.f.createStringLiteral('x'),
                    comment(t, t.f.createStringLiteral('y'), ' about y'),
                  ],
                  true
                )
              ),
              ' about a'
            ),
            property(t, 'b', id(t, 'c')),
          ],
          true
        )
      ),
    expected:
      '{\n    // about a\n    a: [\n        "x",\n        // about y\n        "y"\n    ],\n    b: c\n}',
  },
  {
    name: 'printNode: a new callee that holds a call keeps its parentheses',
    print: (t) =>
      t.adapter.printNode(
        t.newExpression(
          t.f.createPropertyAccessExpression(
            t.f.createCallExpression(id(t, 'a'), undefined, []),
            'c'
          ),
          [id(t, 'x')]
        )
      ),
    expected: 'new (a().c)(x)',
  },
];

interface ListRow {
  format: PrintListFormat;
  nodes(t: Toolkit): ts.Node[];
  expected: string;
}

const listRows: ListRow[] = [
  {
    format: 'namedImportsOrExportsElements',
    nodes: (t) => [
      specifier(t, 'a'),
      t.f.createImportSpecifier(false, id(t, 'b'), id(t, 'c')),
    ],
    expected: ' a, b as c ',
  },
  {
    format: 'objectBindingPatternElements',
    nodes: (t) => [
      t.f.createBindingElement(undefined, undefined, 'a'),
      t.f.createBindingElement(undefined, undefined, 'b'),
    ],
    expected: ' a, b ',
  },
  {
    // An empty source file among the nodes prints nothing.
    format: 'multiLine',
    nodes: (t) => [
      t.f.createImportDeclaration(
        undefined,
        t.f.createImportClause(false, id(t, 'nx'), undefined),
        t.f.createStringLiteral('@nx/eslint-plugin')
      ),
      t.ast.createSourceFile('', '', t.ast.ScriptTarget.Latest, false),
      constStatement(
        t,
        'config',
        t.f.createArrayLiteralExpression(
          [
            t.f.createObjectLiteralExpression(
              [
                comment(
                  t,
                  property(t, 'rules', t.f.createObjectLiteralExpression([])),
                  ' Override or add rules here'
                ),
              ],
              true
            ),
          ],
          true
        )
      ),
    ],
    expected:
      'import nx from "@nx/eslint-plugin";\nconst config = [\n    {\n        // Override or add rules here\n        rules: {}\n    }\n];\n',
  },
];

describe.each(['typescript', '@typescript/native'])(
  'typescript printer with %s',
  (packageName) => {
    let fs: TempFs;
    let t: Toolkit;

    beforeAll(async () => {
      fs = new TempFs('typescript-printer');
      fs.createDirSync('node_modules');
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
      const adapter = await import('./typescript-ast');
      const ast = adapter.getTypescriptAst();
      const backend = getTypescriptBackend();
      const kinds = ast.SyntaxKind as unknown as Record<string, number>;
      const rawFactory =
        backend.kind === 'api' ? backend.factory : backend.ts.factory;
      t = {
        ast,
        f: ast.factory,
        adapter,
        parse: (text, fileName = 'file.ts') =>
          ast.createSourceFile(fileName, text, ast.ScriptTarget.Latest, true),
        find: (root, kind, index = 0) => {
          const found: ts.Node[] = [];
          const visit = (node: ts.Node) => {
            if (node.kind === kinds[kind]) found.push(node);
            ast.forEachChild(node, visit);
          };
          visit(root);
          return found[index] as never;
        },
        newExpression: (callee, args) =>
          (rawFactory.createNewExpression as Function)(callee, undefined, args),
      };
    });

    afterAll(() => {
      fs.cleanup();
    });

    it.each(updateRows)('printNodeUpdate: $name', (row) => {
      const print = () => {
        const [original, updated] = row.edit(t, t.parse(row.source));
        const printed = t.adapter.printNodeUpdate(original, updated);
        const file = original.getSourceFile();
        return (
          file.text.slice(0, original.getStart(file)) +
          printed +
          file.text.slice(original.end)
        );
      };
      if (row.throws !== undefined) {
        expect(print).toThrow(row.throws);
      } else {
        expect(print()).toBe(row.expected);
      }
    });

    it.each(builtRows)('$name', (row) => {
      expect(row.print(t)).toBe(row.expected);
    });

    it.each(listRows)('printList: $format', (row) => {
      expect(t.adapter.printList(row.format, row.nodes(t))).toBe(row.expected);
    });
  }
);
