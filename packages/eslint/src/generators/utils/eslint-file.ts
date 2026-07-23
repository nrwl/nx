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
 */
export function detectTypedLintingShape(
  content: string
): TypedLintingShape | null {
  const blocks = findParserOptions(content);
  if (blocks.some((block) => block.hasProjectService)) {
    return 'project-service';
  }
  if (blocks.some((block) => block.enablesProject)) {
    return 'parser-options-project';
  }
  return null;
}

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
 * Legacy `.eslintrc` files are JSON, flat configs are JS. Parsing tells them
 * apart more reliably than the caller can: `findEslintFile` also turns up
 * `.eslintrc.js`, whose content is JS in an otherwise legacy workspace.
 */
function findParserOptions(content: string): ParserOptions[] {
  const eslintrc = tryParseJson(content);
  return eslintrc
    ? findParserOptionsInJson(eslintrc)
    : findParserOptionsInSource(content);
}

function tryParseJson(content: string): object | null {
  try {
    const parsed = parseJson(content);
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

function findParserOptionsInSource(content: string): ParserOptions[] {
  const { source, checker } = parseSource(content);
  const blocks: ParserOptions[] = [];
  const visit = (node: ts.Node): void => {
    const object = getParserOptionsObject(node, checker);
    if (object) {
      blocks.push(readParserOptions(object, checker));
    }
    ts.forEachChild(node, visit);
  };
  visit(source);
  return blocks;
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
  // append a duplicate or a second, conflicting block.
  if (detectTypedLintingShape(content) !== null) {
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
    const format = determineEslintConfigFormat(content);

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
    const format = determineEslintConfigFormat(content);
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
