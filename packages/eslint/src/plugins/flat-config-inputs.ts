import { ensureTypescript } from '@nx/js/internal';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { builtinModules } from 'node:module';
import {
  dirname,
  extname,
  isAbsolute,
  join,
  relative,
  resolve,
  sep,
} from 'node:path';

export interface FlatConfigInputs {
  externalDependencies: string[];
  files: string[];
}

const RESOLVE_EXTENSIONS = ['.js', '.mjs', '.cjs', '.ts', '.mts', '.cts'];
const PARSEABLE_EXTENSIONS = new Set([...RESOLVE_EXTENSIONS, '.jsx', '.tsx']);

/**
 * Walks a flat config's import graph. Installed packages become external
 * dependencies, relative imports become file inputs (walked in turn), and
 * packages linked into `node_modules` from the workspace become filesets.
 */
export function collectFlatConfigInputs(
  configFile: string,
  workspaceRoot: string
): FlatConfigInputs {
  const externalDependencies = new Set<string>();
  const files = new Set<string>();
  const visited = new Set<string>();
  const realWorkspaceRoot = safeRealpath(workspaceRoot);
  const entry = resolve(workspaceRoot, configFile);

  const visit = (absolutePath: string): void => {
    if (visited.has(absolutePath)) return;
    visited.add(absolutePath);

    let source: string;
    try {
      source = readFileSync(absolutePath, 'utf-8');
    } catch {
      return;
    }

    for (const specifier of extractImportSpecifiers(absolutePath, source)) {
      if (specifier.startsWith('.') || isAbsolute(specifier)) {
        const resolved = resolveLocalFile(
          resolve(dirname(absolutePath), specifier)
        );
        if (!resolved) continue;
        const workspaceRelative = toWorkspaceRelative(workspaceRoot, resolved);
        if (!workspaceRelative) continue;
        files.add(workspaceRelative);
        visit(resolved);
        continue;
      }

      const packageName = getPackageName(specifier);
      if (!packageName) continue;
      const packageDir = findPackageDir(
        packageName,
        dirname(absolutePath),
        workspaceRoot
      );
      if (!packageDir) continue;
      const workspaceRelative = toWorkspaceRelative(
        realWorkspaceRoot,
        safeRealpath(packageDir)
      );
      if (workspaceRelative && !isInNodeModules(workspaceRelative)) {
        files.add(`${workspaceRelative}/**/*`);
      } else {
        externalDependencies.add(packageName);
      }
    }
  };

  visit(entry);
  files.delete(toWorkspaceRelative(workspaceRoot, entry));

  return {
    externalDependencies: Array.from(externalDependencies),
    files: Array.from(files),
  };
}

function extractImportSpecifiers(filePath: string, source: string): string[] {
  const extension = extname(filePath);
  if (!PARSEABLE_EXTENSIONS.has(extension)) return [];

  const ts = ensureTypescript();
  const sourceFile = ts.createSourceFile(
    filePath,
    source,
    ts.ScriptTarget.Latest,
    false,
    extension.endsWith('ts') || extension.endsWith('tsx')
      ? ts.ScriptKind.TS
      : ts.ScriptKind.JS
  );

  const specifiers: string[] = [];
  const walk = (node: import('typescript').Node): void => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.push(node.moduleSpecifier.text);
    } else if (
      ts.isImportEqualsDeclaration(node) &&
      ts.isExternalModuleReference(node.moduleReference) &&
      ts.isStringLiteralLike(node.moduleReference.expression)
    ) {
      specifiers.push(node.moduleReference.expression.text);
    } else if (ts.isCallExpression(node)) {
      const isRequire =
        ts.isIdentifier(node.expression) && node.expression.text === 'require';
      const isDynamicImport =
        node.expression.kind === ts.SyntaxKind.ImportKeyword;
      const [argument] = node.arguments;
      if (
        (isRequire || isDynamicImport) &&
        argument &&
        ts.isStringLiteralLike(argument)
      ) {
        specifiers.push(argument.text);
      }
    }
    ts.forEachChild(node, walk);
  };
  walk(sourceFile);

  return specifiers;
}

function resolveLocalFile(basePath: string): string | null {
  const candidates = [
    basePath,
    ...RESOLVE_EXTENSIONS.map((ext) => `${basePath}${ext}`),
    ...RESOLVE_EXTENSIONS.map((ext) => join(basePath, `index${ext}`)),
  ];
  for (const candidate of candidates) {
    try {
      if (statSync(candidate).isFile()) return candidate;
    } catch {}
  }
  return null;
}

function getPackageName(specifier: string): string | null {
  if (specifier.startsWith('node:') || specifier.startsWith('#')) return null;
  const segments = specifier.split('/');
  const packageName = specifier.startsWith('@')
    ? segments.slice(0, 2).join('/')
    : segments[0];
  if (!packageName || builtinModules.includes(packageName)) return null;
  return packageName;
}

function findPackageDir(
  packageName: string,
  fromDir: string,
  workspaceRoot: string
): string | null {
  let current = fromDir;
  while (true) {
    const candidate = join(current, 'node_modules', packageName);
    if (existsSync(join(candidate, 'package.json'))) return candidate;
    if (current === workspaceRoot || current === dirname(current)) return null;
    current = dirname(current);
  }
}

function toWorkspaceRelative(
  root: string,
  absolutePath: string
): string | null {
  const workspaceRelative = relative(root, absolutePath).split(sep).join('/');
  if (workspaceRelative.startsWith('..') || isAbsolute(workspaceRelative)) {
    return null;
  }
  return workspaceRelative;
}

function isInNodeModules(workspaceRelative: string): boolean {
  return workspaceRelative.split('/').includes('node_modules');
}

function safeRealpath(path: string): string {
  try {
    return realpathSync(path);
  } catch {
    return path;
  }
}
