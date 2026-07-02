import {
  addDependenciesToPackageJson,
  applyChangesToString,
  ChangeType,
  getDependencyVersionFromPackageJson,
  StringChange,
  visitNotIgnoredFiles,
  type Tree,
} from '@nx/devkit';
import { coerce } from 'semver';
import * as ts from 'typescript';
import {
  BASE_ESLINT_CONFIG_FILENAMES,
  ESLINT_FLAT_CONFIG_FILENAMES,
} from '../../utils/config-file';
import {
  addImportToFlatConfig,
  removeImportFromFlatConfig,
} from '../utils/flat-config/ast-utils';

// angular-eslint v22 dropped the legacy eslintrc config format, so every
// `plugin:@angular-eslint/*` shared config stops resolving. The converter emits
// them as `compat.extends(...)` shims (it maps only `plugin:@nx/*` natively), so
// those shims fail to load. Each removed eslintrc config has a flat-native
// counterpart on the umbrella `angular-eslint` package; remap the shims to it.
const ANGULAR_ESLINT_CONFIG_MAP: Record<string, string> = {
  'plugin:@angular-eslint/recommended': 'tsRecommended',
  'plugin:@angular-eslint/all': 'tsAll',
  'plugin:@angular-eslint/template/recommended': 'templateRecommended',
  'plugin:@angular-eslint/template/accessibility': 'templateAccessibility',
  'plugin:@angular-eslint/template/all': 'templateAll',
};

// Not a shared config but a processor: v22 exposes it as `processInlineTemplates`,
// applied via a `{ files, processor }` block rather than an extends spread.
const PROCESS_INLINE_TEMPLATES =
  'plugin:@angular-eslint/template/process-inline-templates';

// angular-eslint v22 removed this rule; a config that still lists it throws on
// load: "Could not find no-conflicting-lifecycle in plugin @angular-eslint".
const REMOVED_RULE = '@angular-eslint/no-conflicting-lifecycle';

const FLAT_CONFIG_FILENAMES = new Set([
  ...ESLINT_FLAT_CONFIG_FILENAMES,
  ...BASE_ESLINT_CONFIG_FILENAMES,
]);

/**
 * Reconciles converted flat configs with angular-eslint v22's breaking changes so
 * they load again. The converter carries the removed `plugin:@angular-eslint/*`
 * configs as FlatCompat shims in two shapes: a bare `...compat.extends(...)` for
 * top-level extends, and a `...compat.config({ extends }).map(...)` for per-override
 * extends. This handles both: shared configs become their flat-native
 * `angular.configs.*` counterparts, and `process-inline-templates` becomes a
 * `processor` block. The per-override shape drops that block when `flat/angular`
 * already applies the processor; the top-level shape keeps it. It also drops the
 * removed `no-conflicting-lifecycle` rule, injects the `angular-eslint` import
 * (and dependency) when it introduces `angular.*` references, and removes the
 * FlatCompat scaffolding left unused afterwards.
 *
 * Gated on angular-eslint v22+: the shims resolve on v18-v21, so rewriting them
 * there would be churn, and only the v22 flat exports are known here. Does not
 * format; the caller owns formatting. Returns whether any file changed.
 */
export async function migrateAngularEslintV22FlatConfig(
  tree: Tree
): Promise<boolean> {
  if (!isAngularEslintV22OrLater(tree)) {
    return false;
  }

  let changed = false;
  let needsAngularDependency = false;

  visitNotIgnoredFiles(tree, '.', (path) => {
    const fileName = path.split('/').pop();
    if (!fileName || !FLAT_CONFIG_FILENAMES.has(fileName)) {
      return;
    }
    const content = tree.read(path, 'utf-8');
    if (!content || !referencesRemovedAngularEslint(content)) {
      return;
    }

    const { updated, introducedAngularRef } = rewriteContent(content);
    if (updated !== content) {
      tree.write(path, updated);
      changed = true;
      needsAngularDependency ||= introducedAngularRef;
    }
  });

  if (needsAngularDependency) {
    addDependenciesToPackageJson(
      tree,
      {},
      { 'angular-eslint': resolveAngularEslintVersion(tree) },
      'package.json',
      true
    );
  }

  return changed;
}

// The umbrella `angular-eslint` and the scoped `@angular-eslint/*` packages
// release in lockstep, so any one reflects the declared version. `nx migrate`
// writes the version bump before migrations run, and the standalone generator
// reads the currently installed version; either way package.json is the source.
function readAngularEslintVersion(tree: Tree): string | undefined {
  return (
    getDependencyVersionFromPackageJson(
      tree,
      '@angular-eslint/eslint-plugin'
    ) ??
    getDependencyVersionFromPackageJson(tree, 'angular-eslint') ??
    getDependencyVersionFromPackageJson(tree, '@angular-eslint/template-parser')
  );
}

// Pin the umbrella to the major already installed, falling back to the latest
// major nx generates when none is present. @nx/eslint can't read the canonical
// pin from @nx/angular without inverting the package dependency (@nx/angular
// depends on @nx/eslint), so the fallback is hardcoded; keep it in sync with
// `angularEslintVersion` in packages/angular/src/utils/versions.ts.
export function resolveAngularEslintVersion(tree: Tree): string {
  const version = readAngularEslintVersion(tree);
  const major = version ? coerce(version)?.major : undefined;

  return major != null ? `^${major}.0.0` : '^22.0.0';
}

function isAngularEslintV22OrLater(tree: Tree): boolean {
  const version = readAngularEslintVersion(tree);
  const major = version ? coerce(version)?.major : undefined;

  return major != null && major >= 22;
}

// Cheap pre-filter so untouched configs are neither parsed nor rewritten.
function referencesRemovedAngularEslint(content: string): boolean {
  return (
    content.includes(REMOVED_RULE) ||
    content.includes(PROCESS_INLINE_TEMPLATES) ||
    Object.keys(ANGULAR_ESLINT_CONFIG_MAP).some((config) =>
      content.includes(config)
    )
  );
}

function rewriteContent(content: string): {
  updated: string;
  introducedAngularRef: boolean;
} {
  // `flat/angular` (from `plugin:@nx/angular`) already applies the inline-template
  // processor, so a process-inline-templates shim alongside it is redundant.
  const flatAngularPresent = /flat\/angular['"]/.test(content);

  // Rewrite the compat shims first, then drop the removed rule on the result: a
  // rule can live inside a shim's `.map` body that pass 1 collapses, so doing
  // both in one pass would collect overlapping edits.
  const { updated: rewritten, introducedAngularRef } = rewriteAngularShims(
    content,
    flatAngularPresent
  );
  const updated = removeRule(rewritten, REMOVED_RULE);

  if (updated === content) {
    return { updated: content, introducedAngularRef: false };
  }

  let cleaned = removeOrphanedFlatCompat(updated);
  if (introducedAngularRef) {
    cleaned = addImportToFlatConfig(cleaned, 'angular', 'angular-eslint');
  }

  return { updated: cleaned, introducedAngularRef };
}

// Rewrites both shapes the converter emits for angular-eslint extends: the bare
// `...compat.extends(...)` spread (top-level extends) and the
// `...compat.config({ extends: [...] }).map(...)` spread (per-override extends).
function rewriteAngularShims(
  content: string,
  flatAngularPresent: boolean
): { updated: string; introducedAngularRef: boolean } {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const changes: StringChange[] = [];
  let introducedAngularRef = false;

  const replaceSpread = (node: ts.SpreadElement, replacement: string) => {
    const start = node.getStart(source);
    changes.push({ type: ChangeType.Delete, start, length: node.end - start });
    changes.push({ type: ChangeType.Insert, index: start, text: replacement });
  };

  const visit = (node: ts.Node): void => {
    if (ts.isSpreadElement(node) && ts.isCallExpression(node.expression)) {
      // Shape 1: `...compat.extends('plugin:@angular-eslint/...', ...)`
      if (node.expression.expression.getText(source) === 'compat.extends') {
        const replacement = buildExtendsReplacement(node.expression.arguments);
        if (replacement !== null) {
          replaceSpread(node, replacement);
          introducedAngularRef = true;
        }
      } else {
        // Shape 2: `...compat.config({ extends: [...] }).map(config => (...))`
        const replacement = buildConfigOverrideReplacement(
          node,
          source,
          flatAngularPresent
        );
        if (replacement !== null) {
          replaceSpread(node, replacement.text);
          introducedAngularRef ||= replacement.introducedAngularRef;
        }
      }
    }

    ts.forEachChild(node, visit);
  };
  visit(source);

  return {
    updated: changes.length ? applyChangesToString(content, changes) : content,
    introducedAngularRef,
  };
}

// Removes every `<rule>: ...` property assignment (with its trailing comma and
// any trailing comment) so the config loads once the rule no longer exists.
function removeRule(content: string, rule: string): string {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const changes: StringChange[] = [];
  const visit = (node: ts.Node): void => {
    if (
      ts.isPropertyAssignment(node) &&
      (ts.isStringLiteral(node.name) ||
        ts.isNoSubstitutionTemplateLiteral(node.name)) &&
      node.name.text === rule
    ) {
      // `getStart` (not `getFullStart`) so leading trivia is left intact; that
      // trivia includes any trailing comment on the previous property.
      const start = node.getStart(source);
      changes.push({
        type: ChangeType.Delete,
        start,
        length: consumeTrailingComma(content, node.end) - start,
      });
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return changes.length ? applyChangesToString(content, changes) : content;
}

type ClassifiedExtend =
  | { kind: 'remapped'; config: string }
  | { kind: 'processor' }
  | { kind: 'other'; value: string };

// Sorts one `extends` entry into the flat-native config it maps to, the inline-
// template processor, or an unrelated config left in a residual compat shim.
// Shared by both shim builders so the classification lives in one place.
function classifyExtend(value: string): ClassifiedExtend {
  const remapped = ANGULAR_ESLINT_CONFIG_MAP[value];
  if (remapped) {
    return { kind: 'remapped', config: remapped };
  }
  if (value === PROCESS_INLINE_TEMPLATES) {
    return { kind: 'processor' };
  }
  return { kind: 'other', value };
}

// Rewrites the per-override shim shape
// `...compat.config({ extends: [E] }).map(config => ({ ...config, files, rules }))`.
// Shared configs in `extends` become `angular.configs.*` scoped to the override's
// files; process-inline-templates becomes a processor block (dropped when
// `flat/angular` already applies it). When `extends` empties, the
// `compat.config(...).map(...)` wrapper collapses to the plain `{ files, rules }`
// block it was scoping. Returns null when the block has no removed angular-eslint
// config, or has a shape beyond a plain `{ extends }` object (left untouched
// rather than risk corrupting it).
function buildConfigOverrideReplacement(
  node: ts.SpreadElement,
  source: ts.SourceFile,
  flatAngularPresent: boolean
): { text: string; introducedAngularRef: boolean } | null {
  const mapCall = node.expression;
  // Structural match (not `getText`) so it survives prettier wrapping the
  // `compat.config(...).map(...)` chain across lines in an already-formatted config.
  if (
    !ts.isCallExpression(mapCall) ||
    mapCall.arguments.length !== 1 ||
    !ts.isArrowFunction(mapCall.arguments[0]) ||
    !ts.isPropertyAccessExpression(mapCall.expression) ||
    mapCall.expression.name.text !== 'map' ||
    !ts.isCallExpression(mapCall.expression.expression)
  ) {
    return null;
  }
  const configCall = mapCall.expression.expression;
  if (
    !ts.isPropertyAccessExpression(configCall.expression) ||
    !ts.isIdentifier(configCall.expression.expression) ||
    configCall.expression.expression.text !== 'compat' ||
    configCall.expression.name.text !== 'config'
  ) {
    return null;
  }

  // Only handle a plain `{ extends: [...string literals] }` object; a block that
  // also carries plugins/env/etc. is left alone rather than partially rewritten.
  const configArg = configCall.arguments[0];
  if (!configArg || !ts.isObjectLiteralExpression(configArg)) {
    return null;
  }
  const extendsProp = configArg.properties.find(
    (prop): prop is ts.PropertyAssignment =>
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === 'extends'
  );
  if (
    !extendsProp ||
    configArg.properties.length !== 1 ||
    !ts.isArrayLiteralExpression(extendsProp.initializer) ||
    !extendsProp.initializer.elements.every((el) => ts.isStringLiteral(el))
  ) {
    return null;
  }

  const remappedConfigs: string[] = [];
  const otherConfigs: string[] = [];
  let hasProcessor = false;
  for (const element of extendsProp.initializer.elements) {
    const classified = classifyExtend((element as ts.StringLiteral).text);
    if (classified.kind === 'remapped') {
      remappedConfigs.push(classified.config);
    } else if (classified.kind === 'processor') {
      hasProcessor = true;
    } else {
      otherConfigs.push(classified.value);
    }
  }
  if (!remappedConfigs.length && !hasProcessor) {
    return null;
  }

  const arrow = mapCall.arguments[0] as ts.ArrowFunction;
  // The collapse branch strips the arrow's `...param` spreads by name, so the
  // param must be a plain identifier; bail otherwise rather than mangle the body.
  const mapParam = arrow.parameters[0]?.name;
  if (!mapParam || !ts.isIdentifier(mapParam)) {
    return null;
  }
  const paramName = mapParam.text;
  const body = arrow.body;
  if (
    !ts.isParenthesizedExpression(body) ||
    !ts.isObjectLiteralExpression(body.expression)
  ) {
    return null;
  }
  const filesProp = body.expression.properties.find(
    (prop): prop is ts.PropertyAssignment =>
      ts.isPropertyAssignment(prop) &&
      ts.isIdentifier(prop.name) &&
      prop.name.text === 'files'
  );
  if (!filesProp) {
    return null;
  }
  const filesText = filesProp.initializer.getText(source);

  const elements: string[] = [];
  let introducedAngularRef = false;
  for (const config of remappedConfigs) {
    // Scope the shared config to the override's files, as the `.map` did.
    elements.push(
      `...angular.configs.${config}.map((c) => ({ ...c, files: ${filesText} }))`
    );
    introducedAngularRef = true;
  }
  if (hasProcessor && !flatAngularPresent) {
    elements.push(
      `{ files: ${filesText}, processor: angular.processInlineTemplates }`
    );
    introducedAngularRef = true;
  }

  if (otherConfigs.length) {
    // Unrelated configs stay in a compat.config, keeping the override's
    // files/rules through the original callback.
    elements.push(
      `...compat.config({ extends: [${otherConfigs
        .map((config) => `'${config}'`)
        .join(', ')}] }).map(${arrow.getText(source)})`
    );
  } else {
    // Nothing left to extend: the `.map` only scoped the extended configs, so
    // collapse it to the plain object it was building, dropping the arrow's now-
    // orphaned `...param` / `...param.rules` spreads once the wrapper that bound
    // the param is gone. The negative lookahead keeps `...param` from matching a
    // longer identifier that merely starts with it.
    const orphanedSpreads = new RegExp(
      `\\.\\.\\.${escapeRegExp(paramName)}(?![\\w$])(?:\\.rules)?\\s*,?\\s*`,
      'g'
    );
    elements.push(body.expression.getText(source).replace(orphanedSpreads, ''));
  }

  return { text: elements.join(',\n'), introducedAngularRef };
}

// Rewrites a `compat.extends(...)` shim's arguments in place: each removed
// angular-eslint config becomes an `angular.configs.*` spread, process-inline-
// templates becomes a processor block, and any unrelated configs stay in a
// residual `compat.extends`. Argument order is preserved (flat config is
// last-wins, so reordering would change rule precedence). Returns the joined
// replacement array elements, or null when no argument is a config nx removed
// (leave the shim untouched).
function buildExtendsReplacement(
  args: ts.NodeArray<ts.Expression>
): string | null {
  // The converter only ever emits string-literal arguments; bail on anything
  // else rather than risk dropping an argument shape we don't understand.
  if (!args.every((arg) => ts.isStringLiteral(arg))) {
    return null;
  }

  const elements: string[] = [];
  let pendingOtherConfigs: string[] = [];
  let replacedAny = false;

  // Emit the run of unrelated configs seen so far as one `compat.extends(...)`
  // at their original position, so they keep their precedence relative to the
  // remapped configs around them.
  const flushOtherConfigs = () => {
    if (pendingOtherConfigs.length) {
      elements.push(
        `...compat.extends(${pendingOtherConfigs
          .map((config) => `'${config}'`)
          .join(', ')})`
      );
      pendingOtherConfigs = [];
    }
  };

  for (const arg of args) {
    const classified = classifyExtend((arg as ts.StringLiteral).text);
    if (classified.kind === 'remapped') {
      flushOtherConfigs();
      elements.push(`...angular.configs.${classified.config}`);
      replacedAny = true;
    } else if (classified.kind === 'processor') {
      flushOtherConfigs();
      elements.push(
        `{ files: ['**/*.ts'], processor: angular.processInlineTemplates }`
      );
      replacedAny = true;
    } else {
      pendingOtherConfigs.push(classified.value);
    }
  }
  flushOtherConfigs();

  return replacedAny ? elements.join(',\n') : null;
}

// Extends past whitespace, comments, the trailing comma after `end`, and a
// same-line comment after that comma so the enclosing object/array stays valid
// after a deletion. Comments before the comma are skipped too: a comment between
// the value and its comma would otherwise leave a dangling leading comma (a
// syntax error); a comment after the comma belonged to the removed entry.
function consumeTrailingComma(content: string, end: number): number {
  const trailing = content
    .slice(end)
    .match(/^(?:\s|\/\/[^\n]*\n?|\/\*[\s\S]*?\*\/)*,[ \t]*(?:\/\/[^\n]*)?/);
  return trailing ? end + trailing[0].length : end;
}

// After the shims are rewritten, the `const compat = new FlatCompat(...)`
// declaration, its `@eslint/eslintrc` import, and the `@eslint/js` import that
// fed its `recommendedConfig` may be left unused. Drop each once nothing else
// references it, so the config carries no dead FlatCompat scaffolding.
function removeOrphanedFlatCompat(content: string): string {
  if (!content.includes('new FlatCompat')) {
    return content;
  }

  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );

  const compatDeclaration = source.statements.find(
    (node): node is ts.VariableStatement =>
      ts.isVariableStatement(node) &&
      node.declarationList.declarations.some(
        (decl) => ts.isIdentifier(decl.name) && decl.name.text === 'compat'
      )
  );

  // The declaration binding is itself one `compat` identifier; anything beyond
  // it means the config still uses `compat`, so leave the scaffolding in place.
  if (!compatDeclaration || countIdentifier(content, 'compat') > 1) {
    return content;
  }

  let updated =
    content.slice(0, compatDeclaration.getFullStart()) +
    content.slice(compatDeclaration.end);
  updated = removeImportFromFlatConfig(
    updated,
    'FlatCompat',
    '@eslint/eslintrc'
  );

  // FlatCompat's `recommendedConfig: js.configs.recommended` is usually the only
  // use of `@eslint/js`; once the declaration is gone and nothing else
  // references `js`, drop that import too.
  if (countIdentifier(updated, 'js') <= 1) {
    updated = removeImportFromFlatConfig(updated, 'js', '@eslint/js');
  }

  return updated;
}

// Counts identifiers with the given name (declarations, bindings, and
// references alike) so callers can tell an orphaned binding from a live one.
function countIdentifier(content: string, name: string): number {
  const source = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.JS
  );
  let count = 0;
  const visit = (node: ts.Node): void => {
    if (ts.isIdentifier(node) && node.text === name) {
      count++;
    }
    ts.forEachChild(node, visit);
  };
  visit(source);

  return count;
}

// Escapes regex metacharacters so a dynamic identifier (an arrow parameter name)
// can be matched literally. Identifiers can legitimately contain `$`.
function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
