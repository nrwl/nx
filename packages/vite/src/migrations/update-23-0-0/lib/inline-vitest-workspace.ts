import { joinPathFragments, type Tree, visitNotIgnoredFiles } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/internal';
import { ast } from '@phenomnomnominal/tsquery';
import type {
  Expression,
  ObjectLiteralExpression,
  ObjectLiteralElementLike,
  PropertyAssignment,
  SourceFile,
} from 'typescript';
import { applyTextEdits } from './ast-edits';
import { isVitestWorkspaceFile } from './vitest-config-files';

let ts: typeof import('typescript');

// Mirrors vitest's own config lookup (CONFIG_NAMES x CONFIG_EXTENSIONS),
// including its vitest-over-vite preference order.
const CONFIG_EXTENSIONS = ['.ts', '.mts', '.cts', '.js', '.mjs', '.cjs'];

const VITEST_CONFIG_RE = /^vitest\.config\.(js|ts|mjs|mts|cjs|cts)$/;
const VITE_CONFIG_RE = /^vite\.config\.(js|ts|mjs|mts|cjs|cts)$/;

/**
 * Inline `vitest.workspace.*` files whose project list is a static array of
 * string literals into the sibling root `vitest.config.*` under
 * `test.projects` (creating the config file when none exists), then delete
 * the workspace file. Vitest 4 removed workspace files entirely.
 *
 * Anything not statically tractable (dynamic arrays, inline project objects,
 * non-object-literal configs, pre-existing `test.projects`) is left in place
 * and reported through `unhandled` for the agent.
 */
export function inlineVitestWorkspaceFiles(
  tree: Tree,
  unhandled: string[]
): { foundWorkspaceFiles: boolean } {
  ts ??= ensureTypescript();

  const workspaceFiles: string[] = [];
  visitNotIgnoredFiles(tree, '', (filePath) => {
    if (isVitestWorkspaceFile(filePath)) workspaceFiles.push(filePath);
  });

  for (const filePath of workspaceFiles) {
    let inlined = false;
    try {
      inlined = tryInlineWorkspaceFile(tree, filePath, unhandled);
    } catch {
      // A failed inline must never fail the migration; the agent handles it.
      inlined = false;
    }
    if (!inlined) {
      unhandled.push(
        `${filePath}: \`vitest.workspace.*\` files are removed in Vitest 4 and this one could not be inlined automatically. ` +
          `Inline its project list into the root \`vitest.config.*\` under \`test.projects\` and delete this file.`
      );
    }
  }

  return { foundWorkspaceFiles: workspaceFiles.length > 0 };
}

function tryInlineWorkspaceFile(
  tree: Tree,
  filePath: string,
  unhandled: string[]
): boolean {
  const globs = extractStaticProjectGlobs(tree.read(filePath, 'utf-8'));
  if (!globs || globs.length === 0) return false;

  const dir = posixDirname(filePath);
  const { negations, advisories } = computeDualConfigNegations(
    tree,
    dir,
    filePath,
    globs
  );
  const entries = [...globs, ...negations];

  const vitestConfigPath = findExistingConfig(tree, dir, 'vitest.config');
  if (vitestConfigPath) {
    if (!tryAddProjectsToConfig(tree, vitestConfigPath, entries)) {
      return false;
    }
  } else if (findExistingConfig(tree, dir, 'vite.config')) {
    // A sibling vite.config may carry its own test block; creating a
    // vitest.config next to it would shadow it for test runs. Let the agent
    // decide where the projects belong.
    return false;
  } else {
    createVitestConfig(tree, dir, filePath, entries);
  }

  tree.delete(filePath);
  unhandled.push(...advisories);
  return true;
}

/**
 * Extracts the project globs from a workspace file when its default export is
 * a plain array of string literals, optionally wrapped in `defineWorkspace`.
 * Returns `null` for any other shape.
 */
function extractStaticProjectGlobs(contents: string): string[] | null {
  const sourceFile = ast(contents);
  const exportAssignment = sourceFile.statements.find(
    (s) => ts.isExportAssignment(s) && !s.isExportEquals
  );
  if (!exportAssignment || !ts.isExportAssignment(exportAssignment)) {
    return null;
  }

  let expression = unwrapExpression(exportAssignment.expression);
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'defineWorkspace' &&
    expression.arguments.length === 1
  ) {
    expression = unwrapExpression(expression.arguments[0]);
  }

  if (!ts.isArrayLiteralExpression(expression)) return null;

  const globs: string[] = [];
  for (const element of expression.elements) {
    if (!ts.isStringLiteral(element)) return null;
    globs.push(element.text);
  }
  return globs;
}

function unwrapExpression(expression: Expression): Expression {
  while (
    ts.isAsExpression(expression) ||
    ts.isSatisfiesExpression(expression) ||
    ts.isParenthesizedExpression(expression)
  ) {
    expression = expression.expression;
  }
  return expression;
}

function findExistingConfig(
  tree: Tree,
  dir: string,
  name: 'vitest.config' | 'vite.config'
): string | undefined {
  for (const ext of CONFIG_EXTENSIONS) {
    const candidate = joinPathFragments(dir, `${name}${ext}`);
    if (tree.exists(candidate)) return candidate;
  }
  return undefined;
}

/**
 * Inserts `projects: [...]` into an existing config file's `test` block (or a
 * whole `test` block when missing). Returns false when the config shape is
 * not statically safe to edit.
 */
function tryAddProjectsToConfig(
  tree: Tree,
  configPath: string,
  entries: string[]
): boolean {
  const contents = tree.read(configPath, 'utf-8');
  const configObject = findDefaultExportConfigObject(ast(contents));
  if (!configObject) return false;
  if (hasSpreadOrUnsupportedProperty(configObject.properties, ['test'])) {
    return false;
  }

  const testProperty = findPropertyAssignment(configObject, 'test');
  const projectsText = `projects: ${formatEntriesArray(entries)}`;

  if (testProperty) {
    const testObject = testProperty.initializer;
    if (!ts.isObjectLiteralExpression(testObject)) return false;
    if (
      hasSpreadOrUnsupportedProperty(testObject.properties, [
        'projects',
        'workspace',
      ])
    ) {
      return false;
    }
    if (
      findPropertyAssignment(testObject, 'projects') ||
      findPropertyAssignment(testObject, 'workspace')
    ) {
      // The config already defines its own project set; merging two project
      // lists is a semantic decision the agent must make.
      return false;
    }
    const insertPos = testObject.getStart() + 1;
    tree.write(
      configPath,
      applyTextEdits(contents, [
        { start: insertPos, end: insertPos, replacement: `${projectsText},` },
      ])
    );
  } else {
    const insertPos = configObject.getStart() + 1;
    tree.write(
      configPath,
      applyTextEdits(contents, [
        {
          start: insertPos,
          end: insertPos,
          replacement: `test: {${projectsText},},`,
        },
      ])
    );
  }
  return true;
}

function createVitestConfig(
  tree: Tree,
  dir: string,
  workspaceFilePath: string,
  entries: string[]
): void {
  const workspaceExt = workspaceFilePath.slice(
    workspaceFilePath.lastIndexOf('.')
  );
  // The generated file uses ESM syntax, so anything that isn't unambiguously
  // ESM-capable (.js depends on package type, .cts/.cjs are CJS) gets .mjs.
  const ext = ['.ts', '.mts', '.mjs'].includes(workspaceExt)
    ? workspaceExt
    : '.mjs';
  tree.write(
    joinPathFragments(dir, `vitest.config${ext}`),
    `import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    projects: ${formatEntriesArray(entries)},
  },
});
`
  );
}

function formatEntriesArray(entries: string[]): string {
  return `[${entries
    .map((e) => `'${e.replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`)
    .join(', ')}]`;
}

/**
 * Vitest errors at startup when two matched config files resolve to the same
 * project name, which is the default outcome for directories holding both a
 * `vite.config.*` and a `vitest.config.*` (both default to the directory's
 * package name). For those directories, exclude the `vite.config.*` file via
 * a negative glob, matching vitest's own vitest-over-vite preference when it
 * resolves a directory entry. Directories whose two configs have statically
 * distinct names are intentionally separate projects and are left alone, as
 * is anything not statically determinable.
 */
function computeDualConfigNegations(
  tree: Tree,
  rootDir: string,
  workspaceFilePath: string,
  globs: string[]
): { negations: string[]; advisories: string[] } {
  // Lazily required to reuse the same module instance as the main migration.
  const picomatch: typeof import('picomatch') = require('picomatch');
  const matchers = globs
    .filter((g) => !g.startsWith('!'))
    // picomatch does not normalize a leading './', vitest's glob layer does.
    .map((g) => picomatch(g.replace(/^\.\//, ''), { dot: true }));

  const matchedByDir = new Map<string, { vite?: string; vitest?: string }>();
  visitNotIgnoredFiles(tree, rootDir === '.' ? '' : rootDir, (filePath) => {
    const relativePath = relativeToDir(filePath, rootDir);
    if (!matchers.some((m) => m(relativePath))) return;
    const base = posixBasename(filePath);
    const dir = posixDirname(filePath);
    const pair = matchedByDir.get(dir) ?? {};
    if (VITEST_CONFIG_RE.test(base)) pair.vitest = filePath;
    else if (VITE_CONFIG_RE.test(base)) pair.vite = filePath;
    matchedByDir.set(dir, pair);
  });

  const negations: string[] = [];
  const advisories: string[] = [];
  for (const [dir, pair] of matchedByDir) {
    if (!pair.vite || !pair.vitest) continue;
    const viteName = determineStaticProjectName(tree, pair.vite);
    const vitestName = determineStaticProjectName(tree, pair.vitest);
    if (viteName === undefined || vitestName === undefined) {
      advisories.push(
        `${workspaceFilePath}: the inlined \`test.projects\` globs match both \`${pair.vite}\` and \`${pair.vitest}\`, and their project names could not be statically compared. ` +
          `If vitest fails at startup with "Project name ... is not unique", exclude one of them from \`test.projects\` with a negative glob (e.g. \`'!${relativeToDir(
            pair.vite,
            rootDir
          )}'\`).`
      );
      continue;
    }
    const resolvedViteName =
      viteName === 'default' ? defaultProjectName(tree, dir) : viteName.name;
    const resolvedVitestName =
      vitestName === 'default'
        ? defaultProjectName(tree, dir)
        : vitestName.name;
    if (resolvedViteName !== resolvedVitestName) continue;
    negations.push(`!${relativeToDir(pair.vite, rootDir)}`);
  }
  return { negations: negations.sort(), advisories: advisories.sort() };
}

/**
 * Statically determines a config file's project name. Returns:
 *   - `{ name }` for an explicit string-literal `test.name`
 *   - `'default'` when no `test.name` is set (vitest falls back to the
 *     directory's package.json name or basename)
 *   - `undefined` when not statically determinable
 */
function determineStaticProjectName(
  tree: Tree,
  configPath: string
): { name: string } | 'default' | undefined {
  const configObject = findDefaultExportConfigObject(
    ast(tree.read(configPath, 'utf-8'))
  );
  if (!configObject) return undefined;
  if (hasSpreadOrUnsupportedProperty(configObject.properties, ['test'])) {
    return undefined;
  }

  const testProperty = findPropertyAssignment(configObject, 'test');
  if (!testProperty) return 'default';
  if (!ts.isObjectLiteralExpression(testProperty.initializer)) {
    return undefined;
  }
  const testObject = testProperty.initializer;
  if (hasSpreadOrUnsupportedProperty(testObject.properties, ['name'])) {
    return undefined;
  }

  const nameProperty = findPropertyAssignment(testObject, 'name');
  if (!nameProperty) return 'default';
  if (ts.isStringLiteral(nameProperty.initializer)) {
    return { name: nameProperty.initializer.text };
  }
  return undefined;
}

function defaultProjectName(tree: Tree, dir: string): string {
  const packageJsonPath = joinPathFragments(dir, 'package.json');
  if (tree.exists(packageJsonPath)) {
    try {
      const name = JSON.parse(tree.read(packageJsonPath, 'utf-8')).name;
      if (typeof name === 'string' && name) return name;
    } catch {}
  }
  return posixBasename(dir);
}

function findDefaultExportConfigObject(
  sourceFile: SourceFile
): ObjectLiteralExpression | undefined {
  const exportAssignment = sourceFile.statements.find(
    (s) => ts.isExportAssignment(s) && !s.isExportEquals
  );
  if (!exportAssignment || !ts.isExportAssignment(exportAssignment)) {
    return undefined;
  }
  let expression = unwrapExpression(exportAssignment.expression);
  if (
    ts.isCallExpression(expression) &&
    ts.isIdentifier(expression.expression) &&
    expression.expression.text === 'defineConfig' &&
    expression.arguments.length === 1
  ) {
    expression = unwrapExpression(expression.arguments[0]);
  }
  return ts.isObjectLiteralExpression(expression) ? expression : undefined;
}

function findPropertyAssignment(
  objectLiteral: ObjectLiteralExpression,
  name: string
): PropertyAssignment | undefined {
  for (const property of objectLiteral.properties) {
    if (
      ts.isPropertyAssignment(property) &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name)) &&
      property.name.text === name
    ) {
      return property;
    }
  }
  return undefined;
}

/**
 * True when the object contains a spread (its contents can't be known
 * statically) or when any of `criticalNames` appears as something other than
 * a plain property assignment (shorthand, method, computed name), in which
 * case edits or reads keyed on those names would be unsafe.
 */
function hasSpreadOrUnsupportedProperty(
  properties: readonly ObjectLiteralElementLike[],
  criticalNames: string[]
): boolean {
  for (const property of properties) {
    if (ts.isSpreadAssignment(property)) return true;
    if (ts.isPropertyAssignment(property)) {
      if (ts.isComputedPropertyName(property.name)) return true;
      continue;
    }
    const name =
      property.name &&
      (ts.isIdentifier(property.name) || ts.isStringLiteral(property.name))
        ? property.name.text
        : undefined;
    if (name === undefined || criticalNames.includes(name)) return true;
  }
  return false;
}

function posixDirname(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? '.' : filePath.slice(0, idx);
}

function posixBasename(filePath: string): string {
  const idx = filePath.lastIndexOf('/');
  return idx === -1 ? filePath : filePath.slice(idx + 1);
}

function relativeToDir(filePath: string, dir: string): string {
  if (dir === '.' || dir === '') return filePath;
  return filePath.startsWith(`${dir}/`)
    ? filePath.slice(dir.length + 1)
    : filePath;
}
