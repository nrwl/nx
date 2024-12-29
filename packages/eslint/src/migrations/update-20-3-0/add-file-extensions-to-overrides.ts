import { type Tree } from '@nx/devkit';
import * as ts from 'typescript';
import { findNodes, replaceChange } from '@nx/js';

export default async function (tree: Tree): Promise<void> {
  let rootConfig: string;

  // NOTE: we don't support generating ESM base config currently so they are not handled.
  for (const candidate of ['eslint.config.js', 'eslint.config.cjs']) {
    if (tree.exists(candidate)) {
      rootConfig = candidate;
      break;
    }
  }

  if (!rootConfig) return;

  updateOverrideFileExtensions(
    tree,
    rootConfig,
    'plugin:@nx/typescript',
    [`'**/*.ts'`, `'**/*.tsx'`],
    [`'**/*.cts'`, `'**/*.mts'`]
  );

  updateOverrideFileExtensions(
    tree,
    rootConfig,
    'plugin:@nx/javascript',
    [`'**/*.js'`, `'**/*.jsx'`],
    [`'**/*.cjs'`, `'**/*.mjs'`]
  );
}

function updateOverrideFileExtensions(
  tree: Tree,
  configFile: string,
  plugin: string,
  matchingExts: string[],
  newExts: string[]
): void {
  const content = tree.read(configFile, 'utf-8');
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  let compatNode: ts.SpreadElement;

  const spreadElementNodes = findNodes(
    source,
    ts.SyntaxKind.SpreadElement
  ) as ts.SpreadElement[];
  for (const a of spreadElementNodes) {
    const assignmentNodes = findNodes(
      a,
      ts.SyntaxKind.PropertyAssignment
    ) as ts.PropertyAssignment[];
    if (assignmentNodes.length === 0) continue;
    for (const b of assignmentNodes) {
      if (
        b.name.getText() === 'extends' &&
        b.initializer.getText().includes(plugin)
      ) {
        compatNode = a;
        break;
      }
    }
  }

  if (compatNode) {
    const arrayNodes = findNodes(
      compatNode,
      ts.SyntaxKind.ArrayLiteralExpression
    ) as ts.ArrayLiteralExpression[];
    for (const a of arrayNodes) {
      if (
        matchingExts.every((ext) => a.elements.some((e) => e.getText() === ext))
      ) {
        const exts = new Set(a.elements.map((e) => e.getText()));
        for (const ext of newExts) {
          exts.add(ext);
        }
        replaceChange(
          tree,
          source,
          configFile,
          a.getStart(a.getSourceFile()),
          `[${Array.from(exts).join(', ')}]`,
          a.getText()
        ).getText();
      }
    }
  }
}
