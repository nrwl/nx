import {
  applyChangesToString,
  ChangeType,
  formatFiles,
  type StringChange,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import type {
  ArrayLiteralExpression,
  CallExpression,
  ImportDeclaration,
  Node,
  VariableStatement,
} from 'typescript';
import { addTsconfigPathsResolution } from '../../utils/vite-config-edit-utils';
import { getInstalledViteMajorVersion } from '../../utils/version-utils';

const CONFIG_FILE = /(?:^|\/)(?:vite|vitest)\.config\.[cm]?[jt]s$/;
const PLUGIN_SPECIFIER = '@nx/vite/plugins/nx-tsconfig-paths.plugin';

// Generated configs carry a commented-out worker example that calls the plugin.
const WORKER_EXAMPLE =
  /^([ \t]*\/\/)\s*plugins: \(\) => \[ nxViteTsPaths\(\) \],[ \t]*$/m;

export default async function migrateNxViteTsPaths(tree: Tree): Promise<void> {
  // `resolve.tsconfigPaths` landed in Vite 8. On anything older the option is
  // ignored, so swapping the plugin for it would silently drop alias
  // resolution; the prompt picks those workspaces up instead.
  const installedMajor = getInstalledViteMajorVersion(tree);
  if (!installedMajor || installedMajor < 8) {
    return;
  }

  let changed = false;

  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!CONFIG_FILE.test(filePath)) return;

    const original = tree.read(filePath, 'utf-8');
    if (!original?.includes('nxViteTsPaths')) return;

    let updated = removePluginUsage(original);
    if (updated === original) return;

    updated = updated.replace(WORKER_EXAMPLE, '$1  plugins: [],');
    updated = addTsconfigPathsResolution(updated);

    tree.write(filePath, updated);
    changed = true;
  });

  if (changed) {
    await formatFiles(tree);
  }
}

/**
 * Drops every `nxViteTsPaths()` call and its import. Bails on the whole file if
 * any call sits somewhere other than directly inside an array, since removing
 * one from an arbitrary expression leaves a syntax hole. The shipped prompt
 * handles what this leaves behind.
 */
function removePluginUsage(content: string): string {
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const tsModule: typeof import('typescript') = require('typescript');
  const file = tsquery.ast(content);

  const calls = (
    tsquery.query(
      file,
      'CallExpression:has(Identifier[name="nxViteTsPaths"])'
    ) as CallExpression[]
  ).filter((call) => call.expression.getText() === 'nxViteTsPaths');
  if (!calls.length) return content;

  const arrays = new Map<ArrayLiteralExpression, CallExpression[]>();
  for (const call of calls) {
    const parent = call.parent;
    if (!parent || !tsModule.isArrayLiteralExpression(parent)) return content;
    const siblings = arrays.get(parent) ?? [];
    siblings.push(call);
    arrays.set(parent, siblings);
  }

  const changes: StringChange[] = [];

  // Reprinting the array from its surviving elements keeps separators valid no
  // matter how many entries are dropped; formatting is restored afterwards.
  for (const [array, removed] of arrays) {
    const survivors = array.elements.filter(
      (element) => !removed.includes(element as CallExpression)
    );
    changes.push({
      type: ChangeType.Delete,
      start: array.getStart(),
      length: array.getEnd() - array.getStart(),
    });
    changes.push({
      type: ChangeType.Insert,
      index: array.getStart(),
      text: `[${survivors.map((element) => element.getText()).join(', ')}]`,
    });
  }

  for (const node of findSolePluginImports(tsModule, tsquery, file)) {
    changes.push({
      type: ChangeType.Delete,
      start: node.getStart(),
      length: trailingNewlineEnd(content, node.getEnd()) - node.getStart(),
    });
  }

  return applyChangesToString(content, changes);
}

/**
 * Import and require statements that bring in nothing but the plugin. Anything
 * sharing the statement stays put; an unused binding is harmless next to a
 * broken one.
 */
function findSolePluginImports(
  tsModule: typeof import('typescript'),
  tsquery: any,
  file: import('typescript').SourceFile
): Node[] {
  const imports = tsquery.query(
    file,
    `ImportDeclaration:has(StringLiteral[value="${PLUGIN_SPECIFIER}"])`
  ) as ImportDeclaration[];
  const requires = tsquery.query(
    file,
    `VariableStatement:has(StringLiteral[value="${PLUGIN_SPECIFIER}"])`
  ) as VariableStatement[];

  const sole: Node[] = [];

  for (const node of imports) {
    const bindings = node.importClause?.namedBindings;
    if (
      bindings &&
      tsModule.isNamedImports(bindings) &&
      bindings.elements.length === 1
    ) {
      sole.push(node);
    }
  }

  for (const node of requires) {
    const declarations = node.declarationList.declarations;
    if (declarations.length !== 1) continue;
    const name = declarations[0].name;
    if (
      tsModule.isObjectBindingPattern(name) &&
      name.elements.length === 1 &&
      name.elements[0].name.getText() === 'nxViteTsPaths'
    ) {
      sole.push(node);
    }
  }

  return sole;
}

function trailingNewlineEnd(content: string, end: number): number {
  while (
    content[end] === ' ' ||
    content[end] === '\t' ||
    content[end] === ';'
  ) {
    end++;
  }
  return content[end] === '\n' ? end + 1 : end;
}
