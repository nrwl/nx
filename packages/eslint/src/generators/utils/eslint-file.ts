import {
  addDependenciesToPackageJson,
  type GeneratorCallback,
  joinPathFragments,
  logger,
  names,
  offsetFromRoot,
  parseJson,
  readJson,
  type Tree,
  updateJson,
} from '@nx/devkit';
import type { Linter } from 'eslint';
import {
  baseEsLintConfigFile,
  ESLINT_CONFIG_FILENAMES,
  BASE_ESLINT_CONFIG_FILENAMES,
  ESLINT_FLAT_CONFIG_FILENAMES,
} from '../../utils/config-file';
import {
  eslintFlatConfigFilenames,
  useFlatConfig,
} from '../../utils/flat-config';
import { eslintCompat, eslintrcVersion } from '../../utils/versions';
import {
  addBlockToFlatConfigExport,
  addFlatCompatToFlatConfig,
  addImportToFlatConfig,
  addPatternsToFlatConfigIgnoresBlock,
  addPluginsToExportsBlock,
  generateAst,
  generateFlatOverride,
  generateFlatPredefinedConfig,
  generatePluginExtendsElement,
  generatePluginExtendsElementWithCompatFixup,
  generateTypedLintingFlatConfigOverride,
  hasFlatConfigIgnoresBlock,
  hasOverride,
  isEsmExport,
  overrideNeedsCompat,
  removeOverridesFromLintConfig,
  replaceOverride,
} from './flat-config/ast-utils';
import { mapFilePath } from './flat-config/path-utils';
import ts = require('typescript');
import { dirname, extname } from 'node:path/posix';

export function findEslintFile(
  tree: Tree,
  projectRoot?: string
): string | null {
  if (projectRoot === undefined) {
    for (const file of [
      baseEsLintConfigFile,
      ...BASE_ESLINT_CONFIG_FILENAMES,
    ]) {
      if (tree.exists(file)) {
        return file;
      }
    }
  }
  projectRoot ??= '';
  for (const file of ESLINT_CONFIG_FILENAMES) {
    if (tree.exists(joinPathFragments(projectRoot, file))) {
      return file;
    }
  }

  return null;
}

export function isEslintConfigSupported(tree: Tree, projectRoot = ''): boolean {
  const eslintFile = findEslintFile(tree, projectRoot);
  if (!eslintFile) {
    return false;
  }
  return (
    eslintFile.endsWith('.json') ||
    eslintFile.endsWith('.config.js') ||
    eslintFile.endsWith('.config.cjs') ||
    eslintFile.endsWith('.config.mjs')
  );
}

export function updateRelativePathsInConfig(
  tree: Tree,
  sourcePath: string,
  destinationPath: string
) {
  if (
    sourcePath === destinationPath ||
    !isEslintConfigSupported(tree, destinationPath)
  ) {
    return;
  }

  const configPath = joinPathFragments(
    destinationPath,
    findEslintFile(tree, destinationPath)
  );
  const offset = offsetFromRoot(destinationPath);

  if (useFlatConfig(tree)) {
    const config = tree.read(configPath, 'utf-8');
    tree.write(
      configPath,
      replaceFlatConfigPaths(config, sourcePath, offset, destinationPath, tree)
    );
  } else {
    updateJson(tree, configPath, (json) => {
      if (typeof json.extends === 'string') {
        json.extends = offsetFilePath(sourcePath, json.extends, offset, tree);
      } else if (json.extends) {
        json.extends = json.extends.map((extend: string) =>
          offsetFilePath(sourcePath, extend, offset, tree)
        );
      }

      json.overrides?.forEach(
        (o: { parserOptions?: { project?: string | string[] } }) => {
          if (o.parserOptions?.project) {
            o.parserOptions.project = Array.isArray(o.parserOptions.project)
              ? o.parserOptions.project.map((p) =>
                  p.replace(sourcePath, destinationPath)
                )
              : o.parserOptions.project.replace(sourcePath, destinationPath);
          }
        }
      );
      return json;
    });
  }
}

function replaceFlatConfigPaths(
  config: string,
  sourceRoot: string,
  offset: string,
  destinationRoot: string,
  tree: Tree
): string {
  let match;
  let newConfig = config;

  // replace requires
  const requireRegex = RegExp(/require\(['"](.*)['"]\)/g);
  while ((match = requireRegex.exec(newConfig)) !== null) {
    const newPath = offsetFilePath(sourceRoot, match[1], offset, tree);
    newConfig =
      newConfig.slice(0, match.index) +
      `require('${newPath}')` +
      newConfig.slice(match.index + match[0].length);
  }

  // Handle import statements
  const importRegex = RegExp(/import\s+.*?\s+from\s+['"](.*)['"]/g);
  while ((match = importRegex.exec(newConfig)) !== null) {
    const oldPath = match[1];
    const newPath = offsetFilePath(sourceRoot, oldPath, offset, tree);

    // Replace the old path with the updated path
    newConfig =
      newConfig.slice(0, match.index + match[0].indexOf(oldPath)) +
      newPath +
      newConfig.slice(match.index + match[0].indexOf(oldPath) + oldPath.length);
  }
  // replace projects
  const projectRegex = RegExp(/project:\s?\[?['"](.*)['"]\]?/g);
  while ((match = projectRegex.exec(newConfig)) !== null) {
    const newProjectDef = match[0].replaceAll(sourceRoot, destinationRoot);
    newConfig =
      newConfig.slice(0, match.index) +
      newProjectDef +
      newConfig.slice(match.index + match[0].length);
  }
  return newConfig;
}

function offsetFilePath(
  projectRoot: string,
  pathToFile: string,
  offset: string,
  tree: Tree
): string {
  if (
    ESLINT_CONFIG_FILENAMES.some((eslintFile) =>
      pathToFile.includes(eslintFile)
    )
  ) {
    // if the file is point to base eslint
    const rootEslint = findEslintFile(tree);
    if (rootEslint) {
      return joinPathFragments(offset, rootEslint);
    }
  }
  if (!pathToFile.startsWith('..')) {
    // not a relative path
    return pathToFile;
  }
  return joinPathFragments(offset, projectRoot, pathToFile);
}

/**
 * The module system a flat config file actually runs under. `.cts` and `.mts`
 * fix it by extension, so the content is only a signal for the ambiguous ones
 * (`.js`, `.ts`). Trusting content alone reads an idiomatic `export default` in
 * a `.cts` as ESM and emits an `import.meta` its CommonJS output rejects.
 */
function determineEslintConfigFormatForFile(
  fileName: string,
  content: string
): 'mjs' | 'cjs' {
  const extension = extname(fileName);
  if (extension === '.mjs' || extension === '.mts') {
    return 'mjs';
  }
  if (extension === '.cjs' || extension === '.cts') {
    return 'cjs';
  }

  return determineEslintConfigFormat(content);
}

export function determineEslintConfigFormat(content: string): 'mjs' | 'cjs' {
  const sourceFile = ts.createSourceFile(
    '',
    content,
    ts.ScriptTarget.Latest,
    true
  );

  return isEsmExport(sourceFile) ? 'mjs' : 'cjs';
}

/**
 * Honors both `enableTypedLinting` and the deprecated `setParserOptionsProject`
 * (slated for removal in Nx v24); either one truthy enables typed linting. A
 * generator whose `enableTypedLinting` schema default is `false` must still
 * honor a user who set the deprecated flag.
 */
export function isTypedLintingEnabled(options: {
  enableTypedLinting?: boolean;
  setParserOptionsProject?: boolean;
}): boolean {
  return !!(options.enableTypedLinting || options.setParserOptionsProject);
}

/**
 * What a config says about typed linting.
 *
 * Only keys inside a `parserOptions` object count, so an unrelated `project`
 * (e.g. `settings['import/resolver'].typescript.project`) is not a false match.
 * A local array the config spreads in is read too, since ESLint merges those
 * entries in as if they were inline.
 */
export function inspectTypedLinting(content: string): TypedLintingReport {
  const readings = findParserOptions(content);
  const blocks = readings.filter(isReadParserOptions);
  const own = blocks.some(
    (block) => block.projectService !== 'absent' || block.enablesProject
  );

  return {
    own,
    projectService: blocks.some((block) => block.projectService === 'enabled'),
    project: blocks.some((block) => block.enablesProject),
    // A local `parserOptions` set through an expression we can't read leaves
    // typed linting undecided: appending would risk converting a `project`
    // setup to the project service, so callers warn and skip. A definite setting
    // (own) already decides the outcome, so it takes precedence.
    uncertain: !own && readings.some((reading) => reading === UNREADABLE),
  };
}

/**
 * What a config configures for typed linting, read from its `parserOptions`
 * (a local array it spreads in included, since ESLint merges those entries).
 */
export interface TypedLintingReport {
  /**
   * Typed-linting parser options are set at all, an explicit
   * `projectService: false` opt-out included, since overwriting that would
   * undo a deliberate choice.
   */
  own: boolean;
  /**
   * The project service is on, which covers every file the config applies to
   * whichever tsconfig each one belongs to.
   */
  projectService: boolean;
  /** A `project` typescript-eslint builds a program from is set. */
  project: boolean;
  /**
   * A local `parserOptions` is present but set through an expression we can't
   * read statically (a call, an imported reference, a dynamic key), so whether
   * it configures typed linting is unknown. Distinct from a config that merely
   * spreads in another file (no local `parserOptions`), which stays safe to
   * append to.
   */
  uncertain: boolean;
}

/** How a `parserOptions` object sets `projectService`. */
type ProjectServiceSetting = 'enabled' | 'disabled' | 'absent';

/**
 * What one `parserOptions` object says about typed linting.
 *
 * Both keys accept a falsy value that leaves typed linting off:
 * typescript-eslint builds a program (and rejects a sibling `projectService`)
 * only when `project` is truthy, and runs the project service only when
 * `projectService` is. An explicit `false`/`null`/`undefined` therefore has to
 * stay distinguishable from an absent key. Anything we can't evaluate (a
 * variable reference, an ES shorthand) counts as set, since assuming typed
 * linting is off risks appending a conflicting block over a working config.
 */
interface ParserOptions {
  projectService: ProjectServiceSetting;
  enablesProject: boolean;
}

/**
 * A `parserOptions` present in a config position whose value can't be read
 * statically. It carries no settings, so it can't be a `ParserOptions`; it marks
 * the result undecided rather than reading as no typed linting.
 */
const UNREADABLE = 'unreadable';
type ParserOptionsReading = ParserOptions | typeof UNREADABLE;

function isReadParserOptions(
  reading: ParserOptionsReading
): reading is ParserOptions {
  return reading !== UNREADABLE;
}

/**
 * A legacy config can be JSON, JS or YAML, and a bare `.eslintrc` can be any of
 * them, so each parser is tried in turn rather than picked from the filename.
 * YAML goes last: a one-line JS config can parse as YAML into a mapping keyed on
 * the whole line, which would otherwise preempt the parser that understands it.
 */
function findParserOptions(content: string): ParserOptionsReading[] {
  const eslintrc = tryParseJson(content);
  if (eslintrc) {
    return findParserOptionsInJson(eslintrc);
  }

  const blocks = findParserOptionsInSource(content);
  if (blocks.length > 0) {
    return blocks;
  }

  const yaml = tryParseYaml(content);
  return yaml ? findParserOptionsInJson(yaml) : blocks;
}

function tryParseJson(content: string): object | null {
  try {
    const parsed = parseJson(content);
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * `@zkochan/js-yaml` is an optional peer, so a workspace without it reads a YAML
 * config as no typed linting, which is what happened before YAML was parsed at
 * all.
 */
function tryParseYaml(content: string): object | null {
  try {
    const { load } = require('@zkochan/js-yaml');
    const parsed = load(content, { json: true });
    return typeof parsed === 'object' && parsed !== null ? parsed : null;
  } catch {
    return null;
  }
}

/**
 * A legacy config carries parser options at the top level and in each
 * `overrides` entry, and ESLint rejects a nested `overrides`, so those are the
 * only two places to read. Walking the whole document instead would pick up a
 * `parserOptions` that configures something else, such as one inside a rule's
 * options.
 */
function findParserOptionsInJson(config: object): ParserOptions[] {
  const blocks: ParserOptions[] = [];
  const read = (entry: unknown): void => {
    const options = (entry as Record<string, unknown> | null)?.parserOptions;
    if (typeof options === 'object' && options !== null) {
      blocks.push(readJsonParserOptions(options as Record<string, unknown>));
    }
  };
  read(config);
  const { overrides } = config as Record<string, unknown>;
  if (Array.isArray(overrides)) {
    overrides.forEach(read);
  }

  return blocks;
}

function readJsonParserOptions(
  options: Record<string, unknown>
): ParserOptions {
  return {
    projectService: !('projectService' in options)
      ? 'absent'
      : isFalsyValue(options.projectService)
        ? 'disabled'
        : 'enabled',
    enablesProject: 'project' in options && !isFalsyValue(options.project),
  };
}

function isFalsyValue(value: unknown): boolean {
  return value === false || value === null || value === undefined;
}

function findParserOptionsInSource(content: string): ParserOptionsReading[] {
  const { source, checker } = parseSource(content);
  const configs = findConfigExpressions(source);
  if (configs.length === 0) {
    // No recognizable export (e.g. a `.eslintrc.js` legacy config, or a
    // tokenizer-only fixture): scan the whole source. That can read a
    // `parserOptions` from a declaration the config never uses, but a real flat
    // config exports its array, so the structured walk covers those.
    return collectParserOptions(source, checker, new Set());
  }
  const seen = new Set<ts.Node>();

  return configs.flatMap((config) => walkValue(config, checker, seen));
}

/**
 * The value each config export denotes: `export default <expr>` (or `export =`)
 * and `module.exports = <expr>`. Only exports declared in this file, so an export
 * assembled in another module names nothing this walk reads.
 */
function findConfigExpressions(source: ts.SourceFile): ts.Expression[] {
  const expressions: ts.Expression[] = [];
  for (const statement of source.statements) {
    if (ts.isExportAssignment(statement)) {
      expressions.push(statement.expression);
    } else if (
      ts.isExpressionStatement(statement) &&
      ts.isBinaryExpression(statement.expression) &&
      statement.expression.operatorToken.kind === ts.SyntaxKind.EqualsToken &&
      isModuleExports(statement.expression.left)
    ) {
      expressions.push(statement.expression.right);
    }
  }

  return expressions;
}

/** The `module.exports` target of a CommonJS config's top-level assignment. */
function isModuleExports(node: ts.Expression): boolean {
  return (
    ts.isPropertyAccessExpression(node) &&
    ts.isIdentifier(node.expression) &&
    node.expression.text === 'module' &&
    node.name.text === 'exports'
  );
}

const IGNORED_CONFIG_KEYS = new Set(['rules', 'settings', 'plugins']);

/**
 * A property whose value never holds real parser options, so the walk can skip
 * its subtree. A rule's options, a `settings` value and a `plugins` map can each
 * carry an object with a `parserOptions` key that configures something else;
 * ESLint reads parser options only from `languageOptions`.
 */
function isIgnoredConfigKey(name: ts.PropertyName): boolean {
  return IGNORED_CONFIG_KEYS.has(getPropertyName(name) ?? '');
}

/**
 * Every `parserOptions` reachable from a config value, walking only the
 * positions ESLint reads a config from: array entries, config-object property
 * values (a `rules`/`settings`/`plugins` subtree skipped), object and array
 * spreads, and the arguments of a wrapper call such as `tseslint.config(...)`. A
 * name in any of those positions resolves to its local declaration, so a config
 * assembled from `const` bindings reads the same as an inline one, and a name
 * bound to an import (another file) resolves to nothing. `seen` guards a
 * reference cycle.
 *
 * `inConfigPosition` tracks whether the value itself sits where ESLint reads a
 * config from, as opposed to being an ordinary property value. A wrapper call
 * forwards its arguments as config only in the former; in the latter it is an
 * arbitrary function whose arguments stay unread.
 */
function walkValue(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>,
  inConfigPosition = true
): ParserOptionsReading[] {
  const value = resolveExpressionValue(expression, checker, seen);
  if (!value) {
    return [];
  }
  if (ts.isArrayLiteralExpression(value)) {
    // Elements inherit this array's position: a root config array holds config
    // entries, an array under `files`/`ignores` holds ordinary values.
    return value.elements.flatMap((element) =>
      ts.isSpreadElement(element)
        ? walkValue(element.expression, checker, seen, inConfigPosition)
        : walkValue(element, checker, seen, inConfigPosition)
    );
  }
  if (ts.isObjectLiteralExpression(value)) {
    return value.properties.flatMap((property) =>
      walkProperty(property, checker, seen)
    );
  }
  if (ts.isCallExpression(value)) {
    // A wrapper (`tseslint.config(cfg)`) forwards its arguments as config
    // entries, but only when the call itself sits in a config position; as a
    // property value (`files: getFiles({...})`) the call is arbitrary and its
    // arguments are inputs, not config.
    const results = inConfigPosition
      ? value.arguments.flatMap((argument) =>
          ts.isSpreadElement(argument)
            ? walkValue(argument.expression, checker, seen)
            : walkValue(argument, checker, seen)
        )
      : [];
    // An IIFE (`(() => [...])()`) builds the config in the callee body, so read
    // its returns unconditionally (unlike wrapper arguments), at this call's own
    // position.
    const callee = unwrapExpression(value.expression);
    if (ts.isArrowFunction(callee) || ts.isFunctionExpression(callee)) {
      for (const returned of returnedExpressions(callee)) {
        results.push(...walkValue(returned, checker, seen, inConfigPosition));
      }
    }

    return results;
  }
  if (ts.isConditionalExpression(value)) {
    // Either branch of `cond ? a : b` may be the value at runtime, so a setting
    // in either counts. The branches inherit this value's position.
    return [
      ...walkValue(value.whenTrue, checker, seen, inConfigPosition),
      ...walkValue(value.whenFalse, checker, seen, inConfigPosition),
    ];
  }
  if (ts.isBinaryExpression(value) && isShortCircuit(value.operatorToken)) {
    // A short-circuit (`cond && cfg`, `base || [...]`, `base ?? [...]`) resolves
    // to one operand; read both, since either may be the value at runtime.
    return [
      ...walkValue(value.left, checker, seen, inConfigPosition),
      ...walkValue(value.right, checker, seen, inConfigPosition),
    ];
  }
  if (
    ts.isBinaryExpression(value) &&
    value.operatorToken.kind === ts.SyntaxKind.CommaToken
  ) {
    // A comma expression (`sideEffect(), cfg`) always evaluates to its right
    // operand.
    return walkValue(value.right, checker, seen, inConfigPosition);
  }

  return [];
}

/** The `&&`, `||` and `??` operators, whose result is one of their operands. */
function isShortCircuit(operator: ts.BinaryOperatorToken): boolean {
  return (
    operator.kind === ts.SyntaxKind.AmpersandAmpersandToken ||
    operator.kind === ts.SyntaxKind.BarBarToken ||
    operator.kind === ts.SyntaxKind.QuestionQuestionToken
  );
}

/** The values an inline function returns: a concise arrow body, or each `return`. */
function returnedExpressions(
  fn: ts.ArrowFunction | ts.FunctionExpression
): ts.Expression[] {
  if (!ts.isBlock(fn.body)) {
    return [fn.body];
  }
  const expressions: ts.Expression[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isReturnStatement(node)) {
      if (node.expression) {
        expressions.push(node.expression);
      }

      return;
    }
    // A nested function has its own returns, unrelated to this one's value.
    if (ts.isFunctionLike(node)) {
      return;
    }
    ts.forEachChild(node, visit);
  };
  ts.forEachChild(fn.body, visit);

  return expressions;
}

/** The `parserOptions` a single config-object property contributes. */
function walkProperty(
  property: ts.ObjectLiteralElementLike,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): ParserOptionsReading[] {
  if (ts.isSpreadAssignment(property)) {
    return walkValue(property.expression, checker, seen, false);
  }
  const key = property.name ? getPropertyName(property.name) : null;
  if (key && IGNORED_CONFIG_KEYS.has(key)) {
    return [];
  }
  if (key === 'parserOptions') {
    const object = getParserOptionsObject(property, checker);
    return [object ? readParserOptions(object, checker) : UNREADABLE];
  }
  if (ts.isPropertyAssignment(property)) {
    return walkValue(property.initializer, checker, seen, false);
  }
  if (ts.isShorthandPropertyAssignment(property)) {
    // `{ languageOptions }`: follow the shorthand to its declaration and walk it.
    const declaration =
      checker.getShorthandAssignmentValueSymbol(property)?.declarations?.[0];
    if (
      declaration &&
      ts.isVariableDeclaration(declaration) &&
      declaration.initializer &&
      !seen.has(declaration)
    ) {
      seen.add(declaration);

      return walkValue(declaration.initializer, checker, seen, false);
    }
  }

  return [];
}

/**
 * Export-less fallback: every `parserOptions` reachable from a node, local array
 * spreads followed. A spread of a local array contributes that array's entries;
 * a spread of another module names no file this walk reads.
 */
function collectParserOptions(
  root: ts.Node,
  checker: ts.TypeChecker,
  localSeen: Set<ts.Node>
): ParserOptionsReading[] {
  const blocks: ParserOptionsReading[] = [];
  const visit = (node: ts.Node): void => {
    if (ts.isPropertyAssignment(node) && isIgnoredConfigKey(node.name)) {
      return;
    }
    if (isParserOptionsProperty(node)) {
      const object = getParserOptionsObject(node, checker);
      blocks.push(object ? readParserOptions(object, checker) : UNREADABLE);
    }
    if (ts.isSpreadElement(node)) {
      blocks.push(...followLocalSpread(node.expression, checker, localSeen));
    }
    ts.forEachChild(node, visit);
  };
  visit(root);

  return blocks;
}

/**
 * The expression a name (or an `obj.key` / `obj['key']` on a local object)
 * ultimately denotes, following alias chains such as `const inner = [...]; const
 * base = inner; export default base`. Anything we can't read statically (an
 * import, a dynamic key) resolves to nothing. `seen` guards a cycle like
 * `const a = b; const b = a`.
 */
function resolveExpressionValue(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): ts.Expression | null {
  const unwrapped = unwrapExpression(expression);
  if (
    ts.isPropertyAccessExpression(unwrapped) ||
    ts.isElementAccessExpression(unwrapped)
  ) {
    const value = resolveMemberValue(unwrapped, checker);

    return value ? resolveExpressionValue(value, checker, seen) : null;
  }
  if (!ts.isIdentifier(unwrapped)) {
    return unwrapped;
  }
  const declaration = checker.getSymbolAtLocation(unwrapped)?.declarations?.[0];
  if (
    !declaration ||
    !ts.isVariableDeclaration(declaration) ||
    !declaration.initializer ||
    seen.has(declaration)
  ) {
    return null;
  }
  seen.add(declaration);

  return resolveExpressionValue(declaration.initializer, checker, seen);
}

/**
 * The value at `obj.key` / `obj['key']` when `obj` resolves to a local object
 * literal and the key is a static string. An imported object, a dynamic key or a
 * missing property resolves to nothing. A fresh `seen` isolates the object lookup
 * so sibling accesses on the same registry don't shadow one another.
 */
function resolveMemberValue(
  access: ts.PropertyAccessExpression | ts.ElementAccessExpression,
  checker: ts.TypeChecker
): ts.Expression | null {
  const key = memberKey(access);
  if (key === null) {
    return null;
  }
  const object = resolveObjectExpression(access.expression, checker, new Set());
  if (!object) {
    return null;
  }

  return lookupObjectKey(object, key, checker, new Set()).value;
}

/**
 * The value bound to `key` in an object literal, honoring source order (a later
 * property or spread wins, as at runtime) across plain, shorthand and spread
 * properties. `found` separates an absent key (an earlier value stands) from a
 * present but unreadable one (it clears the earlier value); an unreadable spread
 * object can't prove the key is present, so it leaves an earlier value in place.
 * `seen` is the recursion stack, so a spread cycle stops while the same object
 * reached again through a sibling spread still gets read.
 */
function lookupObjectKey(
  object: ts.ObjectLiteralExpression,
  key: string,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): { found: boolean; value: ts.Expression | null } {
  if (seen.has(object)) {
    return { found: false, value: null };
  }
  seen.add(object);
  let result: { found: boolean; value: ts.Expression | null } = {
    found: false,
    value: null,
  };
  for (const property of object.properties) {
    if (ts.isPropertyAssignment(property)) {
      if (getPropertyName(property.name) === key) {
        result = { found: true, value: property.initializer };
      }
    } else if (ts.isShorthandPropertyAssignment(property)) {
      if (property.name.text === key) {
        result = { found: true, value: shorthandValue(property, checker) };
      }
    } else if (ts.isSpreadAssignment(property)) {
      const spread = resolveObjectExpression(
        property.expression,
        checker,
        new Set()
      );
      const fromSpread = spread
        ? lookupObjectKey(spread, key, checker, seen)
        : null;
      if (fromSpread && fromSpread.found) {
        result = fromSpread;
      }
    }
  }
  seen.delete(object);

  return result;
}

/** The initializer a shorthand property's binding was declared with. */
function shorthandValue(
  property: ts.ShorthandPropertyAssignment,
  checker: ts.TypeChecker
): ts.Expression | null {
  const declaration =
    checker.getShorthandAssignmentValueSymbol(property)?.declarations?.[0];

  return declaration &&
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer
    ? declaration.initializer
    : null;
}

/** The static key of a member access, or `null` for a dynamic one. */
function memberKey(
  access: ts.PropertyAccessExpression | ts.ElementAccessExpression
): string | null {
  if (ts.isPropertyAccessExpression(access)) {
    return access.name.text;
  }
  const argument = access.argumentExpression;
  if (ts.isStringLiteralLike(argument) || ts.isNumericLiteral(argument)) {
    return argument.text;
  }

  return null;
}

/** A local array the config spreads in; its entries belong to this config. */
function followLocalSpread(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  localSeen: Set<ts.Node>
): ParserOptionsReading[] {
  // Only a name needs following. An inline array is already being walked as
  // part of the surrounding config, so resolving it again would double-count.
  // A name bound to an imported module resolves to nothing here (only a local
  // declaration has an initializer to read), so a spread config from another
  // file contributes nothing and the caller is free to append.
  const unwrapped = unwrapExpression(expression);
  if (!ts.isIdentifier(unwrapped)) {
    return [];
  }
  const value = resolveExpressionValue(expression, checker, localSeen);

  return value ? collectParserOptions(value, checker, localSeen) : [];
}

/**
 * Parses the config with a type checker attached, so a `parserOptions` written
 * as a reference resolves under real scope rules (shadowing, destructuring,
 * parameters, imports) rather than an approximation of them. One in-memory
 * file, no lib and no module resolution, so nothing reads from disk.
 */
function parseSource(content: string): {
  source: ts.SourceFile;
  checker: ts.TypeChecker;
} {
  // Parsed as TS: flat configs may be `.ts`/`.cts`/`.mts`, and TS is a superset,
  // so the same parse covers the `.js` variants.
  const fileName = 'eslint.config.ts';
  const source = ts.createSourceFile(
    fileName,
    content,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS
  );
  const host: ts.CompilerHost = {
    getSourceFile: (name) => (name === fileName ? source : undefined),
    getDefaultLibFileName: () => 'lib.d.ts',
    writeFile: () => {},
    getCurrentDirectory: () => '',
    getCanonicalFileName: (name) => name,
    useCaseSensitiveFileNames: () => true,
    getNewLine: () => '\n',
    fileExists: (name) => name === fileName,
    readFile: (name) => (name === fileName ? content : undefined),
  };
  const program = ts.createProgram(
    [fileName],
    { noLib: true, allowJs: true, types: [] },
    host
  );

  return { source, checker: program.getTypeChecker() };
}

/** A `parserOptions` property, whether written in full or by ES shorthand. */
function isParserOptionsProperty(node: ts.Node): boolean {
  return (
    (ts.isShorthandPropertyAssignment(node) &&
      node.name.text === 'parserOptions') ||
    (ts.isPropertyAssignment(node) &&
      getPropertyName(node.name) === 'parserOptions')
  );
}

/**
 * The `parserOptions` object a node contributes: an inline literal, or the
 * literal behind a reference (`parserOptions: opts`, or the `{ parserOptions }`
 * shorthand). A variable only counts once the config actually references it, so
 * an unused declaration configures nothing.
 */
function getParserOptionsObject(
  node: ts.Node,
  checker: ts.TypeChecker
): ts.ObjectLiteralExpression | null {
  if (
    ts.isShorthandPropertyAssignment(node) &&
    node.name.text === 'parserOptions'
  ) {
    return resolveSymbolObject(
      checker.getShorthandAssignmentValueSymbol(node),
      checker,
      new Set()
    );
  }
  if (
    !ts.isPropertyAssignment(node) ||
    getPropertyName(node.name) !== 'parserOptions'
  ) {
    return null;
  }
  return resolveObjectExpression(node.initializer, checker, new Set());
}

/**
 * Strips the expression wrappers that don't change the value, so an object
 * literal behind `as const`, `satisfies`, a non-null assertion or parentheses is
 * still read as one.
 */
function unwrapExpression(node: ts.Expression): ts.Expression {
  let current = node;
  while (
    ts.isParenthesizedExpression(current) ||
    ts.isAsExpression(current) ||
    ts.isSatisfiesExpression(current) ||
    ts.isNonNullExpression(current) ||
    ts.isTypeAssertionExpression(current)
  ) {
    current = current.expression;
  }
  return current;
}

/**
 * The object literal an expression ultimately denotes, following alias chains
 * (`const opts = typed`) and a static member access on a local object
 * (`registry.opts`). Anything else the name could be bound to (a parameter, a
 * destructured property, a call result, an import, a dynamic key) can't be read
 * statically, so it resolves to nothing and leaves the config alone. `seen`
 * guards against a cycle such as `const a = b; const b = a`.
 */
function resolveObjectExpression(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): ts.ObjectLiteralExpression | null {
  const unwrapped = unwrapExpression(expression);
  if (ts.isObjectLiteralExpression(unwrapped)) {
    return unwrapped;
  }
  if (
    ts.isPropertyAccessExpression(unwrapped) ||
    ts.isElementAccessExpression(unwrapped)
  ) {
    const value = resolveMemberValue(unwrapped, checker);

    return value ? resolveObjectExpression(value, checker, seen) : null;
  }
  if (!ts.isIdentifier(unwrapped) || seen.has(unwrapped)) {
    return null;
  }
  seen.add(unwrapped);

  return resolveSymbolObject(
    checker.getSymbolAtLocation(unwrapped),
    checker,
    seen
  );
}

/** The object literal behind a resolved name, if it was declared with one. */
function resolveSymbolObject(
  symbol: ts.Symbol | undefined,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): ts.ObjectLiteralExpression | null {
  const declaration = symbol?.declarations?.[0];
  return declaration &&
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer
    ? resolveObjectExpression(declaration.initializer, checker, seen)
    : null;
}

/**
 * The properties a `parserOptions` object ends up with, spreads expanded in
 * source order so a later entry overrides an earlier one, as it does at runtime.
 * A value of `null` means the key is set to something we can't read (a shorthand
 * or a nested reference). `seen` is the recursion stack, so a spread cycle stops
 * while the same object spread again later still gets read.
 */
function flattenProperties(
  node: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): { properties: Map<string, ts.Expression | null>; unreadable: boolean } {
  const properties = new Map<string, ts.Expression | null>();
  let unreadable = false;
  if (seen.has(node)) {
    return { properties, unreadable };
  }
  seen.add(node);

  for (const property of node.properties) {
    if (ts.isSpreadAssignment(property)) {
      const spread = resolveObjectExpression(
        property.expression,
        checker,
        new Set()
      );
      if (!spread) {
        unreadable = true;
        continue;
      }
      const nested = flattenProperties(spread, checker, seen);
      unreadable ||= nested.unreadable;
      for (const [key, value] of nested.properties) {
        properties.set(key, value);
      }
      continue;
    }

    const key = property.name ? getPropertyName(property.name) : null;
    if (!key) {
      // A computed key could be either of the ones we look for.
      unreadable = true;
      continue;
    }
    properties.set(
      key,
      ts.isPropertyAssignment(property) ? property.initializer : null
    );
  }
  seen.delete(node);

  return { properties, unreadable };
}

function readParserOptions(
  node: ts.ObjectLiteralExpression,
  checker: ts.TypeChecker
): ParserOptions {
  const { properties, unreadable } = flattenProperties(
    node,
    checker,
    new Set()
  );
  const project = properties.get('project');

  return {
    projectService: !properties.has('projectService')
      ? 'absent'
      : isFalsyLiteral(properties.get('projectService'))
        ? 'disabled'
        : 'enabled',
    // A shorthand (`{ project }`) hides its value, and an unreadable spread could
    // carry any `project` at all; both count, since assuming typed linting is off
    // risks appending a conflicting block over a working config.
    enablesProject:
      unreadable || (properties.has('project') && !isFalsyLiteral(project)),
  };
}

function getPropertyName(name: ts.PropertyName): string | null {
  return ts.isIdentifier(name) ||
    ts.isStringLiteral(name) ||
    ts.isNumericLiteral(name)
    ? name.text
    : null;
}

function isFalsyLiteral(node: ts.Expression | null): boolean {
  if (!node) {
    return false;
  }
  return (
    node.kind === ts.SyntaxKind.FalseKeyword ||
    node.kind === ts.SyntaxKind.NullKeyword ||
    (ts.isIdentifier(node) && node.text === 'undefined')
  );
}

/**
 * Adds a typed-linting block (`parserOptions.projectService` + `tsconfigRootDir`)
 * to a project's flat ESLint config. No-op for legacy `.eslintrc` configs, whose
 * JSON format cannot express the `__dirname` that `tsconfigRootDir` needs.
 *
 * Use after operations that strip existing overrides (e.g.
 * `replaceOverridesInLintConfig`) to re-establish typed linting.
 */
export function addTypedLintingToFlatConfig(tree: Tree, root: string): void {
  if (!useFlatConfig(tree)) {
    return;
  }
  let fileName: string | undefined;
  for (const f of eslintFlatConfigFilenames) {
    if (tree.exists(joinPathFragments(root, f))) {
      fileName = joinPathFragments(root, f);
      break;
    }
  }
  if (!fileName) {
    return;
  }
  const content = tree.read(fileName, 'utf8');
  // Idempotent: leave the config alone only when it configures typed-linting
  // parser options itself, an explicit `projectService: false` opt-out included.
  // Typed linting a config merely spreads in from another file need not cover
  // this project (its globs may be scoped elsewhere), and the appended block
  // defuses any inherited `project` anyway, so it is no reason to skip.
  const report = inspectTypedLinting(content);
  if (report.own) {
    return;
  }
  if (report.uncertain) {
    // A local `parserOptions` set through an expression we can't read could
    // already enable `project`; appending would silently convert it to the
    // project service, so leave the config for the user to complete instead.
    logger.warn(
      `Could not tell whether typed linting is already set up in "${fileName}" because its \`parserOptions\` is built from an expression Nx cannot read statically. Left it unchanged; add \`languageOptions: { parserOptions: { projectService: true } }\` yourself if typed linting is not configured.`
    );
    return;
  }
  // The block carries `tsconfigRootDir`, whose value differs per module system,
  // so the extension has to win over the content where it is decisive.
  const format = determineEslintConfigFormatForFile(fileName, content);
  const block = generateTypedLintingFlatConfigOverride(format);
  const updated = addBlockToFlatConfigExport(content, block);
  if (updated === content) {
    // `addBlockToFlatConfigExport` only edits a plain array export
    // (`export default [...]` / `module.exports = [...]`). A wrapper config such
    // as `export default tseslint.config(...)` is left untouched, so warn rather
    // than silently dropping the request.
    logger.warn(
      `Could not enable typed linting in "${fileName}" because its ESLint flat config is not a plain array export. Add \`languageOptions: { parserOptions: { projectService: true } }\` to enable typed linting.`
    );
    return;
  }
  tree.write(fileName, updated);
}

export function addOverrideToLintConfig(
  tree: Tree,
  root: string,
  override: Partial<Linter.ConfigOverride<Linter.RulesRecord>>,
  options: { insertAtTheEnd?: boolean; checkBaseConfig?: boolean } = {
    insertAtTheEnd: true,
  }
) {
  const isBase =
    options.checkBaseConfig && findEslintFile(tree, root).includes('.base');
  if (useFlatConfig(tree)) {
    let fileName: string | undefined;
    if (isBase) {
      for (const file of BASE_ESLINT_CONFIG_FILENAMES) {
        if (tree.exists(joinPathFragments(root, file))) {
          fileName = joinPathFragments(root, file);
          break;
        }
      }
    } else {
      for (const f of eslintFlatConfigFilenames) {
        if (tree.exists(joinPathFragments(root, f))) {
          fileName = joinPathFragments(root, f);
          break;
        }
      }
    }

    let content = tree.read(fileName, 'utf8');
    const format = determineEslintConfigFormatForFile(fileName, content);

    const flatOverride = generateFlatOverride(override, format);
    // Check if the provided override using legacy eslintrc properties or plugins, if so we need to add compat
    if (overrideNeedsCompat(override)) {
      content = addFlatCompatToFlatConfig(content);
    }
    tree.write(
      fileName,
      addBlockToFlatConfigExport(content, flatOverride, options)
    );
  } else {
    const fileName = joinPathFragments(
      root,
      isBase ? baseEsLintConfigFile : '.eslintrc.json'
    );
    updateJson(tree, fileName, (json) => {
      json.overrides ??= [];
      if (options.insertAtTheEnd) {
        json.overrides.push(override);
      } else {
        json.overrides.unshift(override);
      }
      return json;
    });
  }
}

export function updateOverrideInLintConfig(
  tree: Tree,
  rootOrFile: string,
  lookup: (override: Linter.ConfigOverride<Linter.RulesRecord>) => boolean,
  update: (
    override: Linter.ConfigOverride<Linter.RulesRecord>
  ) => Linter.ConfigOverride<Linter.RulesRecord>
) {
  let fileName: string | undefined;
  let root = rootOrFile;
  if (tree.exists(rootOrFile) && tree.isFile(rootOrFile)) {
    fileName = rootOrFile;
    root = dirname(rootOrFile);
  }

  if (useFlatConfig(tree)) {
    if (!fileName) {
      for (const f of eslintFlatConfigFilenames) {
        if (tree.exists(joinPathFragments(root, f))) {
          fileName = joinPathFragments(root, f);
          break;
        }
      }
    }

    let content = tree.read(fileName, 'utf8');
    content = replaceOverride(content, root, lookup, update);
    tree.write(fileName, content);
  } else {
    fileName ??= joinPathFragments(root, '.eslintrc.json');
    if (!tree.exists(fileName)) {
      return;
    }
    const existingJson = readJson(tree, fileName);
    if (!existingJson.overrides || !existingJson.overrides.some(lookup)) {
      return;
    }
    updateJson(tree, fileName, (json: Linter.LegacyConfig) => {
      const index = json.overrides.findIndex(lookup);
      if (index !== -1) {
        const newOverride = update(json.overrides[index]);
        if (newOverride) {
          json.overrides[index] = newOverride;
        } else {
          json.overrides.splice(index, 1);
        }
      }
      return json;
    });
  }
}

export function lintConfigHasOverride(
  tree: Tree,
  rootOrFile: string,
  lookup: (override: Linter.ConfigOverride<Linter.RulesRecord>) => boolean,
  checkBaseConfig = false
): boolean {
  let fileName: string | undefined;
  let root = rootOrFile;
  if (tree.exists(rootOrFile) && tree.isFile(rootOrFile)) {
    fileName = rootOrFile;
    root = dirname(rootOrFile);
  }
  if (!fileName && !isEslintConfigSupported(tree, root)) {
    return false;
  }
  const isBase =
    !fileName &&
    checkBaseConfig &&
    findEslintFile(tree, root).includes('.base');
  if (isBase) {
    for (const file of BASE_ESLINT_CONFIG_FILENAMES) {
      if (tree.exists(joinPathFragments(root, file))) {
        fileName = joinPathFragments(root, file);
        break;
      }
    }
  }
  if (useFlatConfig(tree)) {
    if (!fileName) {
      for (const f of eslintFlatConfigFilenames) {
        if (tree.exists(joinPathFragments(root, f))) {
          fileName = joinPathFragments(root, f);
          break;
        }
      }
    }
    const content = tree.read(fileName, 'utf8');
    return hasOverride(content, lookup);
  } else {
    fileName ??= joinPathFragments(
      root,
      isBase ? baseEsLintConfigFile : '.eslintrc.json'
    );

    return readJson(tree, fileName).overrides?.some(lookup) || false;
  }
}

export function replaceOverridesInLintConfig(
  tree: Tree,
  root: string,
  overrides: Linter.ConfigOverride<Linter.RulesRecord>[]
) {
  if (useFlatConfig(tree)) {
    let fileName: string | undefined;
    for (const f of eslintFlatConfigFilenames) {
      if (tree.exists(joinPathFragments(root, f))) {
        fileName = joinPathFragments(root, f);
        break;
      }
    }
    let content = tree.read(fileName, 'utf8');
    const format = determineEslintConfigFormatForFile(fileName, content);
    // Check if any of the provided overrides using legacy eslintrc properties or plugins, if so we need to add compat
    if (overrides.some(overrideNeedsCompat)) {
      content = addFlatCompatToFlatConfig(content);
    }
    content = removeOverridesFromLintConfig(content);
    overrides.forEach((override) => {
      const flatOverride = generateFlatOverride(override, format);
      content = addBlockToFlatConfigExport(content, flatOverride);
    });

    tree.write(fileName, content);
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.overrides = overrides;
      return json;
    });
  }
}

export function addExtendsToLintConfig(
  tree: Tree,
  root: string,
  plugin:
    | string
    | { name: string; needCompatFixup: boolean }
    | Array<string | { name: string; needCompatFixup: boolean }>,
  insertAtTheEnd = false
): GeneratorCallback {
  if (useFlatConfig(tree)) {
    const pluginExtends: ts.SpreadElement[] = [];
    let fileName: string | undefined;
    for (const f of eslintFlatConfigFilenames) {
      if (tree.exists(joinPathFragments(root, f))) {
        fileName = joinPathFragments(root, f);
        break;
      }
    }
    // Check the file extension to determine the format of the config if it is .js we look for the export
    const eslintConfigFormat = fileName.endsWith('.mjs')
      ? 'mjs'
      : fileName.endsWith('.cjs')
        ? 'cjs'
        : tree.read(fileName, 'utf-8').includes('module.exports')
          ? 'cjs'
          : 'mjs';

    let shouldImportEslintCompat = false;
    // eslint v9 requires the incompatible plugins to be wrapped with a helper from @eslint/compat
    const plugins = (Array.isArray(plugin) ? plugin : [plugin]).map((p) =>
      typeof p === 'string' ? { name: p, needCompatFixup: false } : p
    );
    let compatiblePluginsBatch: string[] = [];
    plugins.forEach(({ name, needCompatFixup }) => {
      if (needCompatFixup) {
        if (compatiblePluginsBatch.length > 0) {
          // flush the current batch of compatible plugins and reset it
          pluginExtends.push(
            generatePluginExtendsElement(compatiblePluginsBatch)
          );
          compatiblePluginsBatch = [];
        }
        // generate the extends for the incompatible plugin
        pluginExtends.push(generatePluginExtendsElementWithCompatFixup(name));
        shouldImportEslintCompat = true;
      } else {
        // add the compatible plugin to the current batch
        compatiblePluginsBatch.push(name);
      }
    });

    if (compatiblePluginsBatch.length > 0) {
      // flush the batch of compatible plugins
      pluginExtends.push(generatePluginExtendsElement(compatiblePluginsBatch));
    }

    let content = tree.read(fileName, 'utf8');
    if (shouldImportEslintCompat) {
      content = addImportToFlatConfig(
        content,
        ['fixupConfigRules'],
        '@eslint/compat'
      );
    }
    content = addFlatCompatToFlatConfig(content);
    // reverse the order to ensure they are added in the correct order at the
    // start of the `extends` array
    for (const pluginExtend of pluginExtends.reverse()) {
      content = addBlockToFlatConfigExport(content, pluginExtend, {
        insertAtTheEnd,
      });
    }
    tree.write(fileName, content);

    if (shouldImportEslintCompat) {
      return addDependenciesToPackageJson(
        tree,
        {},
        { '@eslint/compat': eslintCompat, '@eslint/eslintrc': eslintrcVersion },
        undefined,
        true
      );
    }

    return addDependenciesToPackageJson(
      tree,
      {},
      { '@eslint/eslintrc': eslintrcVersion },
      undefined,
      true
    );
  } else {
    const plugins = (Array.isArray(plugin) ? plugin : [plugin]).map((p) =>
      typeof p === 'string' ? p : p.name
    );
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.extends ??= [];
      json.extends = [
        ...plugins,
        ...(Array.isArray(json.extends) ? json.extends : [json.extends]),
      ];
      return json;
    });

    return () => {};
  }
}

export function addPredefinedConfigToFlatLintConfig(
  tree: Tree,
  root: string,
  predefinedConfigName: string,
  options: {
    moduleName?: string;
    moduleImportPath?: string;
    spread?: boolean;
    insertAtTheEnd?: boolean;
    checkBaseConfig?: boolean;
  } = {}
): void {
  const {
    moduleName = 'nx',
    moduleImportPath = '@nx/eslint-plugin',
    spread = true,
    insertAtTheEnd = true,
    checkBaseConfig = false,
  } = options;

  if (!useFlatConfig(tree))
    throw new Error('Predefined configs can only be used with flat configs');

  let fileName: string | undefined;
  for (const f of eslintFlatConfigFilenames) {
    if (tree.exists(joinPathFragments(root, f))) {
      fileName = joinPathFragments(root, f);
      break;
    }
  }

  let content = tree.read(fileName, 'utf8');
  content = addImportToFlatConfig(content, moduleName, moduleImportPath);
  content = addBlockToFlatConfigExport(
    content,
    generateFlatPredefinedConfig(predefinedConfigName, moduleName, spread),
    { insertAtTheEnd, checkBaseConfig }
  );

  tree.write(fileName, content);
}

export function addPluginsToLintConfig(
  tree: Tree,
  root: string,
  plugin: string | string[]
) {
  const plugins = Array.isArray(plugin) ? plugin : [plugin];
  if (useFlatConfig(tree)) {
    let fileName: string | undefined;
    for (const f of eslintFlatConfigFilenames) {
      if (tree.exists(joinPathFragments(root, f))) {
        fileName = joinPathFragments(root, f);
        break;
      }
    }

    let content = tree.read(fileName, 'utf8');
    const mappedPlugins: { name: string; varName: string; imp: string }[] = [];
    plugins.forEach((name) => {
      const imp = getPluginImport(name);
      const varName = names(imp).propertyName;
      mappedPlugins.push({ name, varName, imp });
    });
    mappedPlugins.forEach(({ varName, imp }) => {
      content = addImportToFlatConfig(content, varName, imp);
    });
    content = addPluginsToExportsBlock(content, mappedPlugins);
    tree.write(fileName, content);
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    updateJson(tree, fileName, (json) => {
      json.plugins = [...plugins, ...(json.plugins ?? [])];
      return json;
    });
  }
}

export function addIgnoresToLintConfig(
  tree: Tree,
  root: string,
  ignorePatterns: string[]
) {
  if (useFlatConfig(tree)) {
    let fileName: string | undefined;
    for (const f of eslintFlatConfigFilenames) {
      if (tree.exists(joinPathFragments(root, f))) {
        fileName = joinPathFragments(root, f);
        break;
      }
    }

    if (!fileName) {
      return;
    }

    let content = tree.read(fileName, 'utf8');
    if (hasFlatConfigIgnoresBlock(content)) {
      content = addPatternsToFlatConfigIgnoresBlock(content, ignorePatterns);
      tree.write(fileName, content);
    } else {
      const block = generateAst<ts.ObjectLiteralExpression>({
        ignores: ignorePatterns.map((path) => mapFilePath(path)),
      });
      tree.write(fileName, addBlockToFlatConfigExport(content, block));
    }
  } else {
    const fileName = joinPathFragments(root, '.eslintrc.json');
    if (!tree.exists(fileName)) {
      return;
    }
    updateJson(tree, fileName, (json) => {
      const ignoreSet = new Set([
        ...(json.ignorePatterns ?? []),
        ...ignorePatterns,
      ]);
      json.ignorePatterns = Array.from(ignoreSet);
      return json;
    });
  }
}

export function getPluginImport(pluginName: string): string {
  if (pluginName.includes('eslint-plugin-')) {
    return pluginName;
  }
  if (!pluginName.startsWith('@')) {
    return `eslint-plugin-${pluginName}`;
  }
  if (!pluginName.includes('/')) {
    return `${pluginName}/eslint-plugin`;
  }
  const [scope, name] = pluginName.split('/');
  return `${scope}/eslint-plugin-${name}`;
}
