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
 * Returns whether typed linting was requested for a generator. Accepts both the
 * new `enableTypedLinting` flag and the deprecated `setParserOptionsProject`
 * flag (slated for removal in Nx v24); either one set to a truthy value enables
 * the feature. This is intentional: a generator whose `enableTypedLinting`
 * schema default is `false` must still honor a user who set the deprecated flag.
 */
export function isTypedLintingEnabled(options: {
  enableTypedLinting?: boolean;
  setParserOptionsProject?: boolean;
}): boolean {
  return !!(options.enableTypedLinting || options.setParserOptionsProject);
}

export type TypedLintingShape = 'project-service' | 'parser-options-project';

/**
 * Reads the configs a flat config spreads in (`...baseConfig`), so detection can
 * follow the import that names them.
 */
export interface SpreadConfigReader {
  /** Path of the config whose content is being inspected. */
  path: string;
  /**
   * The spread config's path and content, or `null` when it can't be read: a
   * package import, or a file the tree doesn't hold.
   */
  read(
    specifier: string,
    fromPath: string
  ): { path: string; content: string } | null;
}

/**
 * Detects whether an existing ESLint config file content has typed linting
 * configured and which shape it uses, so callers can preserve the user's
 * existing configuration when adding new overrides.
 *
 * - `'project-service'`: modern typescript-eslint v8 shape with an explicit
 *   `parserOptions.projectService`. A `false` opt-out still counts so callers
 *   preserve it instead of overwriting it.
 * - `'parser-options-project'`: legacy shape using `parserOptions.project`.
 * - `null`: no typed-linting parser options detected.
 *
 * Only keys inside a `parserOptions` object count, so an unrelated `project`
 * (e.g. `settings['import/resolver'].typescript.project`) is not a false match.
 *
 * Pass `spreads` to follow the configs a flat config spreads in. Without it only
 * the given content is inspected, which is all a legacy `.eslintrc` needs.
 */
export function detectTypedLintingShape(
  content: string,
  spreads?: SpreadConfigReader
): TypedLintingShape | null {
  return inspectTypedLinting(content, spreads).shape;
}

/**
 * What a config says about typed linting, plus whether the walk was complete.
 *
 * `unresolvedSpread` means a spread named a config we could not read, so a
 * `project` may be in effect that `shape` does not report. Callers that append a
 * `projectService` block need it: ESLint merges `parserOptions` across entries,
 * and typescript-eslint rejects a merged truthy `project` next to it.
 */
export interface TypedLintingReport {
  shape: TypedLintingShape | null;
  unresolvedSpread: boolean;
}

export function inspectTypedLinting(
  content: string,
  spreads?: SpreadConfigReader
): TypedLintingReport {
  const walk: ConfigWalk = { seenExports: new Set(), unresolvedSpread: false };
  const blocks = findParserOptions(content, spreads, walk);
  const shape = blocks.some((block) => block.hasProjectService)
    ? 'project-service'
    : blocks.some((block) => block.enablesProject)
      ? 'parser-options-project'
      : null;

  return { shape, unresolvedSpread: walk.unresolvedSpread };
}

/**
 * State carried through one config walk. `seenExports` stops a cycle between two
 * configs spreading each other; `unresolvedSpread` records that the walk hit a
 * config it could not read, so its answer is a lower bound.
 */
interface ConfigWalk {
  seenExports: Set<string>;
  unresolvedSpread: boolean;
}

/**
 * Spreads of configs we ship ourselves. They are the three `...nx.configs[...]`
 * entries in every generated root config, and none of them sets
 * `parserOptions.project`, so treating them as read keeps the common path off
 * the uncertain branch. Pinned by a test over the shipped presets.
 */
const KNOWN_SAFE_CONFIG_PACKAGE = '@nx/eslint-plugin';

/**
 * What one `parserOptions` object says about typed linting.
 *
 * `project` accepts `boolean | string | string[] | null`, and typescript-eslint
 * only builds a program (and only rejects a sibling `projectService`) when the
 * value is truthy. An explicit `false`/`null`/`undefined` therefore leaves typed
 * linting off and conflicts with nothing, so it must not count. Anything we
 * can't evaluate (a variable reference, an ES shorthand) does count, since
 * assuming it's off risks appending a conflicting block over a working config.
 */
interface ParserOptions {
  hasProjectService: boolean;
  enablesProject: boolean;
}

/**
 * A legacy config can be JSON, JS or YAML, and a bare `.eslintrc` can be any of
 * them, so each parser is tried in turn rather than picked from the filename.
 * YAML goes last: a one-line JS config can parse as YAML into a mapping keyed on
 * the whole line, which would otherwise preempt the parser that understands it.
 */
function findParserOptions(
  content: string,
  spreads: SpreadConfigReader | undefined,
  walk: ConfigWalk
): ParserOptions[] {
  const eslintrc = tryParseJson(content);
  if (eslintrc) {
    return findParserOptionsInJson(eslintrc);
  }

  const blocks = findParserOptionsInSource(content, spreads, walk);
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

function findParserOptionsInJson(config: object): ParserOptions[] {
  const blocks: ParserOptions[] = [];
  const visit = (value: unknown): void => {
    if (Array.isArray(value)) {
      value.forEach(visit);
      return;
    }
    if (typeof value !== 'object' || value === null) {
      return;
    }
    const record = value as Record<string, unknown>;
    const options = record.parserOptions;
    if (typeof options === 'object' && options !== null) {
      const { project } = options as Record<string, unknown>;
      blocks.push({
        hasProjectService: 'projectService' in options,
        enablesProject:
          'project' in options &&
          project !== false &&
          project !== null &&
          project !== undefined,
      });
    }
    Object.values(record).forEach(visit);
  };
  visit(config);
  return blocks;
}

function findParserOptionsInSource(
  content: string,
  spreads: SpreadConfigReader | undefined,
  walk: ConfigWalk
): ParserOptions[] {
  const { source, checker } = parseSource(content);

  return collectParserOptions(source, checker, spreads, walk, new Set());
}

/**
 * Every `parserOptions` reachable from a node, spreads followed. A spread of
 * another module contributes only the export it selects, and a spread of a local
 * array contributes that array's entries.
 */
function collectParserOptions(
  root: ts.Node,
  checker: ts.TypeChecker,
  spreads: SpreadConfigReader | undefined,
  walk: ConfigWalk,
  localSeen: Set<ts.Node>
): ParserOptions[] {
  const blocks: ParserOptions[] = [];
  const visit = (node: ts.Node): void => {
    const object = getParserOptionsObject(node, checker);
    if (object) {
      blocks.push(readParserOptions(object, checker));
    }
    if (spreads && ts.isSpreadElement(node)) {
      blocks.push(...followSpread(node, checker, spreads, walk, localSeen));
    }
    ts.forEachChild(node, visit);
  };
  visit(root);

  return blocks;
}

/**
 * The typed-linting settings a spread pulls in. ESLint merges `parserOptions`
 * across every config entry matching a file, so typed linting set in a spread
 * config conflicts with a block appended here just as an inline one would.
 * `seenExports` stops a cycle between two configs spreading each other.
 */
function followSpread(
  node: ts.SpreadElement,
  checker: ts.TypeChecker,
  spreads: SpreadConfigReader,
  walk: ConfigWalk,
  localSeen: Set<ts.Node>
): ParserOptions[] {
  const reference = getImportedModuleReference(node.expression, checker);
  if (reference) {
    return collectFromImportedExport(reference, spreads, walk);
  }
  if (isKnownSafeSpread(node.expression, checker)) {
    return [];
  }

  return followLocalSpread(node.expression, checker, spreads, walk, localSeen);
}

/**
 * Whether a spread names a config we ship, whose contents we therefore already
 * know. `...nx.configs['flat/base']` reads a member of a package import rather
 * than the import itself, so nothing else here can follow it.
 */
function isKnownSafeSpread(
  expression: ts.Expression,
  checker: ts.TypeChecker
): boolean {
  let current = unwrapExpression(expression);
  while (
    ts.isPropertyAccessExpression(current) ||
    ts.isElementAccessExpression(current)
  ) {
    current = unwrapExpression(current.expression);
  }
  if (!ts.isIdentifier(current)) {
    return false;
  }
  const declaration = checker.getSymbolAtLocation(current)?.declarations?.[0];
  if (!declaration) {
    return false;
  }
  const moduleSpecifier = ts.isImportClause(declaration)
    ? declaration.parent.moduleSpecifier
    : ts.isImportSpecifier(declaration)
      ? declaration.parent.parent.parent.moduleSpecifier
      : null;

  return (
    !!moduleSpecifier &&
    getModuleSpecifierText(moduleSpecifier) === KNOWN_SAFE_CONFIG_PACKAGE
  );
}

/** Reads the module an expression referenced, once per export. */
function collectFromImportedExport(
  reference: ImportedModuleReference,
  spreads: SpreadConfigReader,
  walk: ConfigWalk
): ParserOptions[] {
  const imported = spreads.read(reference.specifier, spreads.path);
  if (!imported) {
    if (reference.specifier !== KNOWN_SAFE_CONFIG_PACKAGE) {
      walk.unresolvedSpread = true;
    }
    return [];
  }
  // Keyed per export, not per file: one config can spread two exports of the
  // same module, and the second must still be read.
  const visited = `${imported.path}:${reference.exportName}`;
  if (walk.seenExports.has(visited)) {
    return [];
  }
  walk.seenExports.add(visited);

  return findParserOptionsInExport(
    imported.content,
    reference.exportName,
    { ...spreads, path: imported.path },
    walk
  );
}

/**
 * What one export of a config module contributes. Scanning the whole module
 * would attribute an unrelated export's `parserOptions` to the config actually
 * spread in, so only the selected export's value is walked. An export we cannot
 * locate contributes nothing, leaving the caller free to append.
 */
function findParserOptionsInExport(
  content: string,
  exportName: string,
  spreads: SpreadConfigReader,
  walk: ConfigWalk
): ParserOptions[] {
  const { source, checker } = parseSource(content);
  const exported = findExportedExpression(source, exportName);
  if (!exported) {
    // A barrel forwards the export without ever binding it locally, so there is
    // no expression here to walk, only another module to read.
    const forwarded = findReExportedModule(source, exportName);
    if (forwarded) {
      return collectFromImportedExport(forwarded, spreads, walk);
    }
    walk.unresolvedSpread = true;
    return [];
  }
  // The export may hand straight back a config from somewhere else
  // (`import inner from './deep.mjs'; export default inner`).
  const reference = getImportedModuleReference(exported, checker);
  if (reference) {
    return collectFromImportedExport(reference, spreads, walk);
  }
  // Otherwise it names the config rather than spelling it out, so the name has
  // to be followed before there is anything to walk.
  const localSeen = new Set<ts.Node>();
  const value = resolveExpressionValue(exported, checker, localSeen);

  return value
    ? collectParserOptions(value, checker, spreads, walk, localSeen)
    : [];
}

/**
 * The expression a name ultimately denotes, following alias chains such as
 * `const inner = [...]; const base = inner; export default base`. A name bound
 * to anything we can't read statically resolves to nothing. `seen` guards a
 * cycle like `const a = b; const b = a`.
 */
function resolveExpressionValue(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  seen: Set<ts.Node>
): ts.Expression | null {
  const unwrapped = unwrapExpression(expression);
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

/** The value an export name is bound to, in either module system. */
function findExportedExpression(
  source: ts.SourceFile,
  exportName: string
): ts.Expression | null {
  for (const statement of source.statements) {
    if (exportName === DEFAULT_EXPORT) {
      if (ts.isExportAssignment(statement)) {
        return statement.expression;
      }
      const assigned = getModuleExportsAssignment(statement);
      if (assigned) {
        return assigned;
      }
      continue;
    }
    if (!ts.isVariableStatement(statement) || !isExported(statement)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        ts.isIdentifier(declaration.name) &&
        declaration.name.text === exportName &&
        declaration.initializer
      ) {
        return declaration.initializer;
      }
    }
  }

  return null;
}

/**
 * The module an export is forwarded from, for a barrel that re-exports rather
 * than binding: `export { default } from './base.mjs'`.
 */
function findReExportedModule(
  source: ts.SourceFile,
  exportName: string
): ImportedModuleReference | null {
  for (const statement of source.statements) {
    if (!ts.isExportDeclaration(statement) || !statement.moduleSpecifier) {
      continue;
    }
    const specifier = getModuleSpecifierText(statement.moduleSpecifier);
    if (!specifier) {
      continue;
    }
    if (!statement.exportClause) {
      // `export * from` forwards every named export, but never the default one.
      if (exportName !== DEFAULT_EXPORT) {
        return { specifier, exportName };
      }
      continue;
    }
    if (!ts.isNamedExports(statement.exportClause)) {
      continue;
    }
    for (const element of statement.exportClause.elements) {
      if (element.name.text === exportName) {
        return {
          specifier,
          exportName: (element.propertyName ?? element.name).text,
        };
      }
    }
  }

  return null;
}

/** The right-hand side of a `module.exports = ...` statement. */
function getModuleExportsAssignment(
  statement: ts.Statement
): ts.Expression | null {
  if (
    !ts.isExpressionStatement(statement) ||
    !ts.isBinaryExpression(statement.expression) ||
    statement.expression.operatorToken.kind !== ts.SyntaxKind.EqualsToken
  ) {
    return null;
  }
  const { left, right } = statement.expression;

  return ts.isPropertyAccessExpression(left) &&
    ts.isIdentifier(left.expression) &&
    left.expression.text === 'module' &&
    left.name.text === 'exports'
    ? right
    : null;
}

function isExported(statement: ts.VariableStatement): boolean {
  return (
    statement.modifiers?.some(
      (modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword
    ) ?? false
  );
}

/** A local array the config spreads in; its entries belong to this config. */
function followLocalSpread(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  spreads: SpreadConfigReader,
  walk: ConfigWalk,
  localSeen: Set<ts.Node>
): ParserOptions[] {
  // Only a name needs following. An inline array is already being walked as
  // part of the surrounding config, so resolving it again would double-count.
  const unwrapped = unwrapExpression(expression);
  if (!ts.isIdentifier(unwrapped)) {
    // Anything else is a value we cannot evaluate: a call, an `await import()`.
    if (!ts.isArrayLiteralExpression(unwrapped)) {
      walk.unresolvedSpread = true;
    }
    return [];
  }
  const value = resolveExpressionValue(expression, checker, localSeen);
  if (!value) {
    walk.unresolvedSpread = true;
    return [];
  }

  return collectParserOptions(value, checker, spreads, walk, localSeen);
}

/** A whole-module reference: a default import, or any `require` call. */
const DEFAULT_EXPORT = 'default';

interface ImportedModuleReference {
  specifier: string;
  /** The export the spread selects, `DEFAULT_EXPORT` for a whole-module one. */
  exportName: string;
}

/**
 * The module and export a spread pulls its entries from, whether the module is
 * named inline (`...require('...')`) or through a binding: `import baseConfig
 * from '...'`, `import { base } from '...'` and `const baseConfig =
 * require('...')`. A local alias of any of those (`const aliased = baseConfig`)
 * resolves to the same module. Anything else the expression could be (a local
 * array, some other call's result) names no file to follow. `seen` guards a
 * cycle such as `const a = b; const b = a`.
 */
function getImportedModuleReference(
  expression: ts.Expression,
  checker: ts.TypeChecker,
  seen: Set<ts.Node> = new Set()
): ImportedModuleReference | null {
  const unwrapped = unwrapExpression(expression);
  if (ts.isCallExpression(unwrapped)) {
    return toDefaultReference(getRequireSpecifier(unwrapped));
  }
  if (!ts.isIdentifier(unwrapped)) {
    return null;
  }
  const declaration = checker.getSymbolAtLocation(unwrapped)?.declarations?.[0];
  if (!declaration) {
    return null;
  }

  if (ts.isImportClause(declaration)) {
    return toDefaultReference(
      getModuleSpecifierText(declaration.parent.moduleSpecifier)
    );
  }
  if (ts.isImportSpecifier(declaration)) {
    const specifier = getModuleSpecifierText(
      declaration.parent.parent.parent.moduleSpecifier
    );
    return specifier
      ? {
          specifier,
          exportName: (declaration.propertyName ?? declaration.name).text,
        }
      : null;
  }
  if (
    ts.isVariableDeclaration(declaration) &&
    declaration.initializer &&
    !seen.has(declaration)
  ) {
    seen.add(declaration);
    return getImportedModuleReference(declaration.initializer, checker, seen);
  }

  return null;
}

function toDefaultReference(
  specifier: string | null
): ImportedModuleReference | null {
  return specifier ? { specifier, exportName: DEFAULT_EXPORT } : null;
}

/** The module a `require('...')` call names. */
function getRequireSpecifier(node: ts.CallExpression): string | null {
  if (!ts.isIdentifier(node.expression) || node.expression.text !== 'require') {
    return null;
  }
  const [argument] = node.arguments;

  return argument ? getModuleSpecifierText(argument) : null;
}

function getModuleSpecifierText(node: ts.Expression): string | null {
  return ts.isStringLiteral(node) ? node.text : null;
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
 * (`const opts = typed`). Anything else the name could be bound to (a parameter,
 * a destructured property, a call result, an import) can't be read statically,
 * so it resolves to nothing and leaves the config alone. `seen` guards against a
 * cycle such as `const a = b; const b = a`.
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
 * or a nested reference).
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
        seen
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
    hasProjectService: properties.has('projectService'),
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
 * A spread config as the tree holds it. Only a relative specifier can name a
 * workspace file; a package import resolves through `node_modules`, which is not
 * ours to read.
 */
function readSpreadConfig(
  tree: Tree,
  specifier: string,
  fromPath: string
): { path: string; content: string } | null {
  if (!specifier.startsWith('.')) {
    return null;
  }
  const path = joinPathFragments(dirname(fromPath), specifier);
  if (!tree.exists(path)) {
    return null;
  }

  return { path, content: tree.read(path, 'utf8') };
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
  // Idempotent: skip if typed linting is already configured in any shape
  // (modern `projectService` or legacy `parserOptions.project`), so we don't
  // append a duplicate or a second, conflicting block. The configs this one
  // spreads count too, since ESLint merges them into the same file's settings.
  const spreads: SpreadConfigReader = {
    path: fileName,
    read: (specifier, fromPath) => readSpreadConfig(tree, specifier, fromPath),
  };
  const { shape, unresolvedSpread } = inspectTypedLinting(content, spreads);
  if (shape !== null) {
    return;
  }
  // The block carries `tsconfigRootDir`, whose value differs per module system,
  // so the extension has to win over the content where it is decisive.
  const format = determineEslintConfigFormatForFile(fileName, content);
  // A config we could not read may set `project`, so the block defuses it rather
  // than betting on a walk that already came up short.
  const block = generateTypedLintingFlatConfigOverride(
    format,
    undefined,
    unresolvedSpread
  );
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
