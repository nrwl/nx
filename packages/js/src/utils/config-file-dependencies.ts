import { hashArray, normalizePath, readJsonFile } from '@nx/devkit';
import { createTsConfigPathMatcher, hashFile } from '@nx/devkit/internal';
import { existsSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { createRequire, isBuiltin } from 'node:module';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { walkTsconfigExtendsChain } from './typescript/raw-tsconfig';

/**
 * Creates a per-inference-pass collector for the workspace files imported by a
 * config. It does not evaluate the config or reuse resolution from an earlier
 * pass: imports, package exports and tsconfig paths may all have changed.
 *
 * ponytail: only literal module references are discoverable here; computed
 * imports and arbitrary fs reads need runtime dependency tracking.
 */
export function createConfigFileDependencyCollector(workspaceRoot: string) {
  let canonicalWorkspaceRoot: string;
  const imports = new Map<string, string[] | null>();
  const json = new Map<string, any>();
  const hashes = new Map<string, string>();
  const workspacePaths = new Map<string, string | undefined>();
  const existingPaths = new Map<string, boolean>();
  const filePaths = new Map<string, boolean>();
  const packageScopes = new Map<string, string | undefined>();
  const dependencies = new Map<string, Map<string, string[] | null>>();
  const tsconfigs = new Map<
    string,
    {
      files: string[];
      matcher?: ReturnType<typeof createTsConfigPathMatcher>;
      complete: boolean;
    }
  >();

  function workspacePath(path: string): string | undefined {
    if (workspacePaths.has(path)) return workspacePaths.get(path);
    const original = path;
    try {
      path = realpathSync(path);
    } catch (error) {
      if (
        ['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code)
      ) {
        workspacePaths.set(original, undefined);
        return undefined;
      }
      throw error;
    }
    const rel = relative(workspaceRoot, path);
    if (
      rel === '..' ||
      rel.startsWith(`..${sep}`) ||
      isAbsolute(rel) ||
      rel.split(sep).some((part) => part === 'node_modules' || part === '.yarn')
    ) {
      workspacePaths.set(original, undefined);
      return undefined;
    }
    workspacePaths.set(original, path);
    workspacePaths.set(path, path);
    return path;
  }

  function exists(path: string): boolean {
    if (!existingPaths.has(path)) existingPaths.set(path, existsSync(path));
    return existingPaths.get(path);
  }

  function isFile(path: string): boolean {
    if (!filePaths.has(path)) {
      try {
        filePaths.set(path, statSync(path).isFile());
      } catch (error) {
        if (
          !['ENOENT', 'ENOTDIR'].includes((error as NodeJS.ErrnoException).code)
        )
          throw error;
        filePaths.set(path, false);
      }
    }
    return filePaths.get(path);
  }

  function packageScope(file: string): string | undefined {
    let directory = dirname(file);
    const visited: string[] = [];
    let scope: string | undefined;
    while (workspacePath(directory)) {
      if (packageScopes.has(directory)) {
        scope = packageScopes.get(directory);
        break;
      }
      visited.push(directory);
      const manifest = join(directory, 'package.json');
      if (exists(manifest)) {
        scope = manifest;
        break;
      }
      if (directory === workspaceRoot) break;
      directory = dirname(directory);
    }
    for (const directory of visited) packageScopes.set(directory, scope);
    return scope;
  }

  function readJson(path: string) {
    if (!json.has(path)) {
      try {
        json.set(path, readJsonFile(path));
      } catch {
        json.set(path, undefined);
      }
    }
    return json.get(path);
  }

  function getTsconfig(configFile: string) {
    const path = [
      join(dirname(configFile), 'tsconfig.json'),
      join(workspaceRoot, 'tsconfig.base.json'),
      join(workspaceRoot, 'tsconfig.json'),
    ].find(exists);
    if (!path) return { files: [], complete: true };
    if (!tsconfigs.has(path)) {
      const files: string[] = [];
      walkTsconfigExtendsChain(
        path,
        (file) => {
          files.push(file);
          return 'continue';
        },
        { jsonCache: json }
      );
      try {
        tsconfigs.set(path, {
          files,
          matcher: createTsConfigPathMatcher(path),
          complete: true,
        });
      } catch {
        // JavaScript configs may load without consulting a malformed tsconfig.
        tsconfigs.set(path, { files, complete: false });
      }
    }
    return tsconfigs.get(path);
  }

  function getImports(file: string): string[] | null {
    if (!imports.has(file)) {
      const {
        parseSync,
        traverse,
      }: typeof import('@babel/core') = require('@babel/core');
      const found = new Set<string>();
      const source = readFileSync(file, 'utf8');
      let ast: ReturnType<typeof parseSync>;
      try {
        ast = parseSync(source, {
          filename: file,
          babelrc: false,
          configFile: false,
          sourceType: 'unambiguous',
          parserOpts: {
            allowReturnOutsideFunction: true,
            allowAwaitOutsideFunction: true,
            plugins: [
              'typescript',
              'decorators-legacy',
              ...(file.endsWith('x') ? ['jsx' as const] : []),
            ],
          },
        });
      } catch (error) {
        if ((error as any).code !== 'BABEL_PARSE_ERROR') throw error;
        // The loader may support syntax this parser does not. Let it evaluate
        // the config, but never reuse a cache key with an unknown closure.
        imports.set(file, null);
        return null;
      }
      traverse(ast, {
        noScope: true,
        enter({ node }) {
          if (
            node.type === 'ImportDeclaration' ||
            node.type === 'ExportAllDeclaration' ||
            node.type === 'ExportNamedDeclaration'
          ) {
            if (node.source) found.add(node.source.value);
          } else if (
            node.type === 'CallExpression' &&
            (node.callee.type === 'Import' ||
              (node.callee.type === 'Identifier' &&
                node.callee.name === 'require'))
          ) {
            const argument = node.arguments[0];
            if (argument?.type === 'StringLiteral') {
              found.add(argument.value);
            } else if (
              argument?.type === 'TemplateLiteral' &&
              argument.expressions.length === 0 &&
              argument.quasis[0].value.cooked != null
            ) {
              found.add(argument.quasis[0].value.cooked);
            }
          } else if (
            node.type === 'TSImportEqualsDeclaration' &&
            node.moduleReference.type === 'TSExternalModuleReference'
          ) {
            found.add(node.moduleReference.expression.value);
          }
        },
      });
      imports.set(file, [...found]);
    }
    return imports.get(file);
  }

  function getDependencies(
    importer: string,
    matcher: ReturnType<typeof createTsConfigPathMatcher>
  ): string[] | null {
    const key = matcher?.key ?? '';
    if (!dependencies.has(key)) dependencies.set(key, new Map());
    const resolved = dependencies.get(key);
    if (resolved.has(importer)) return resolved.get(importer);

    const specifiers = getImports(importer);
    if (specifiers === null) {
      resolved.set(importer, null);
      return null;
    }
    const result = new Set<string>();
    const add = (path: string) => {
      const local = workspacePath(path);
      if (local) result.add(local);
    };
    const requireFrom = createRequire(importer);
    const scope = packageScope(importer);

    function resolveImport(specifier: string, seen: Set<string>) {
      if (isBuiltin(specifier) || seen.has(specifier)) return;
      seen.add(specifier);
      if (
        specifier.startsWith('file:') ||
        (specifier.startsWith('.') && /[?#%]/.test(specifier))
      ) {
        let path: string | undefined;
        try {
          path = fileURLToPath(new URL(specifier, pathToFileURL(importer)));
        } catch {
          // A CommonJS filename can contain a literal, unescaped percent sign.
        }
        if (path) resolveImport(path, seen);
        if (specifier.startsWith('file:')) return;
      }
      const relativePath =
        specifier.startsWith('.') || isAbsolute(specifier)
          ? resolve(dirname(importer), specifier)
          : undefined;
      let resolvedPath =
        relativePath && isFile(relativePath) ? relativePath : undefined;
      if (!resolvedPath) {
        try {
          resolvedPath = requireFrom.resolve(specifier);
        } catch {
          // Missing optional imports must not prevent config evaluation. A newly
          // created file will be discovered when this pass is run again.
        }
      }
      if (resolvedPath) add(resolvedPath);
      if (
        !resolvedPath &&
        (specifier.startsWith('.') || isAbsolute(specifier))
      ) {
        const path = resolve(dirname(importer), specifier);
        for (const candidate of [
          path,
          ...(/\.[cm]?js$/.test(path)
            ? [
                path.replace(/\.js$/, '.ts'),
                path.replace(/\.js$/, '.tsx'),
                path.replace(/\.mjs$/, '.mts'),
                path.replace(/\.cjs$/, '.cts'),
              ]
            : []),
          ...[
            '.ts',
            '.tsx',
            '.mts',
            '.cts',
            '.js',
            '.jsx',
            '.mjs',
            '.cjs',
            '.json',
          ].flatMap((extension) => [
            path + extension,
            join(path, 'index' + extension),
          ]),
        ]) {
          if (isFile(candidate)) add(candidate);
        }
      }
      if (matcher) {
        const mapped = matcher.matchPath(
          specifier,
          (file) => {
            add(file);
            return readJson(file);
          },
          isFile,
          ['.js', '.json', '.ts', '.tsx', '.mts', '.cts', '.mjs', '.cjs']
        );
        if (mapped) resolveImport(mapped, seen);
      }
      if (specifier.startsWith('.') || isAbsolute(specifier)) return;

      if (specifier.startsWith('#')) {
        for (const target of packageTargets(
          readJson(scope)?.imports,
          specifier
        )) {
          if (target.startsWith('.')) add(resolve(dirname(scope), target));
          else resolveImport(target, seen);
        }
        return;
      }
      const parts = specifier.split('/');
      const name = parts.slice(0, specifier.startsWith('@') ? 2 : 1).join('/');
      const subpath = '.' + specifier.slice(name.length);
      const candidates = [
        ...(scope && readJson(scope)?.name === name ? [scope] : []),
        ...(requireFrom.resolve.paths(specifier) ?? []).map((directory) =>
          join(directory, name, 'package.json')
        ),
      ];
      const manifest = candidates.find(exists);
      if (!manifest || !workspacePath(manifest)) return;
      add(manifest);
      const pkg = readJson(manifest);
      // Hash every applicable conditional target, so ESM-only exports are
      // covered even on a host that only exposes require.resolve().
      for (const target of packageTargets(pkg?.exports, subpath)) {
        if (target.startsWith('./')) add(resolve(dirname(manifest), target));
      }
    }

    for (const specifier of specifiers) resolveImport(specifier, new Set());
    resolved.set(importer, [...result]);
    return resolved.get(importer);
  }

  return (
    configFile: string
  ): { files: string[]; hash: string | undefined } => {
    if (!canonicalWorkspaceRoot) {
      workspaceRoot = canonicalWorkspaceRoot = realpathSync(workspaceRoot);
    }
    const result = new Set<string>();
    const visited = new Set<string>();
    const tsconfig = getTsconfig(resolve(workspaceRoot, configFile));
    let complete = tsconfig.complete;
    const add = (path: string) => {
      const local = workspacePath(path);
      if (local) result.add(normalizePath(relative(workspaceRoot, local)));
      return local;
    };
    tsconfig.files.forEach(add);

    function visit(file: string) {
      file = add(file);
      if (!file || visited.has(file)) return;
      visited.add(file);
      const scope = packageScope(file);
      if (scope) add(scope);
      if (!/\.[cm]?[jt]sx?$/.test(file) || /\.d\.[cm]?ts$/.test(file)) return;
      const dependencies = getDependencies(file, tsconfig.matcher);
      if (dependencies === null) {
        complete = false;
        return;
      }
      dependencies.forEach(visit);
    }

    visit(resolve(workspaceRoot, configFile));
    const files = [...result].sort();
    return {
      files,
      // Workspace glob hashing excludes ignored files. An explicitly imported
      // config still affects inference, so fingerprint its content directly.
      hash: complete
        ? hashArray(
            files.flatMap((file) => {
              if (!hashes.has(file))
                hashes.set(file, hashFile(join(workspaceRoot, file)));
              return [file, hashes.get(file)];
            })
          )
        : undefined,
    };
  };
}

function packageTargets(exports: unknown, subpath: string): string[] {
  const leaves = (value: unknown): string[] =>
    typeof value === 'string'
      ? [value]
      : value && typeof value === 'object'
        ? Object.values(value).flatMap(leaves)
        : [];
  if (!exports || typeof exports !== 'object' || Array.isArray(exports)) {
    return subpath === '.' ? leaves(exports) : [];
  }
  const entries = Object.entries(exports);
  if (!entries.some(([key]) => key.startsWith('.') || key.startsWith('#'))) {
    return subpath === '.' ? leaves(exports) : [];
  }
  return entries.flatMap(([key, value]) => {
    if (key === subpath) return leaves(value);
    const star = key.indexOf('*');
    if (
      star < 0 ||
      !subpath.startsWith(key.slice(0, star)) ||
      !subpath.endsWith(key.slice(star + 1))
    )
      return [];
    const match = subpath.slice(star, subpath.length - key.length + star + 1);
    return leaves(value).map((target) => target.replaceAll('*', match));
  });
}
