import { execFile } from 'node:child_process';
import { access, readFile } from 'node:fs/promises';
import { dirname, join, relative, resolve } from 'node:path';
import { promisify } from 'node:util';
import type { CreateDependenciesContext } from '@nx/devkit';
import ts from 'typescript';
import { detectBundlersForProject } from './bundlers';
import type { NormalizedOptions } from './options';
import type { ImportInsight, RawDependency, TargetMatchData } from './types';

const execFileAsync = promisify(execFile);

type ParsedFile = {
  text: string;
  ast: ts.SourceFile;
};

class FileCache {
  private readonly parsed = new Map<string, Promise<ParsedFile>>();
  private readonly existence = new Map<string, Promise<boolean>>();

  getOrParse(filePath: string): Promise<ParsedFile> {
    const existing = this.parsed.get(filePath);
    if (existing) return existing;

    const promise = readFile(filePath, 'utf8').then((text) => {
      const ast = ts.createSourceFile(
        filePath,
        text,
        ts.ScriptTarget.Latest,
        true,
        scriptKindFromPath(filePath)
      );
      return { text, ast };
    });
    this.parsed.set(filePath, promise);
    return promise;
  }

  exists(filePath: string): Promise<boolean> {
    const cached = this.existence.get(filePath);
    if (cached !== undefined) return cached;
    const promise = access(filePath).then(
      () => true,
      () => false
    );
    this.existence.set(filePath, promise);
    return promise;
  }
}

export async function narrowDependencies(
  dependencies: RawDependency[],
  context: CreateDependenciesContext,
  options: NormalizedOptions
): Promise<RawDependency[]> {
  const cache = new FileCache();
  const targetMatchMap = await buildTargetMatchMap(context, options);

  type Phase1Result = {
    dep: RawDependency;
    keep: boolean | 'reexport-pending';
    reexport?: ReexportEdge;
  };

  const phase1Results: Phase1Result[] = await Promise.all(
    dependencies.map(async (dep): Promise<Phase1Result> => {
      if (dep.type !== 'static') return { dep, keep: true };
      if (!dep.sourceFile) return { dep, keep: true };

      if (dep.sourceFile.endsWith('package.json')) {
        return { dep, keep: false };
      }

      const targetMatch = targetMatchMap.get(dep.target);
      if (!targetMatch) return { dep, keep: true };

      if (options.respectSideEffects && targetMatch.sideEffects) {
        return { dep, keep: true };
      }

      const sourceProject = context.projects[dep.source];
      if (!sourceProject) return { dep, keep: true };

      const sourceFilePath = join(context.workspaceRoot, dep.sourceFile);
      if (!(await cache.exists(sourceFilePath))) {
        return { dep, keep: true };
      }

      const { text: sourceText, ast: sourceAst } =
        await cache.getOrParse(sourceFilePath);

      const importInsight = await analyzeImportsForTarget({
        sourceAst,
        sourceText,
        sourceFilePath,
        targetMatch,
        workspaceRoot: context.workspaceRoot,
        removeTypeOnlyEdges: options.removeTypeOnlyEdges,
        resolveNamespaceImports: options.resolveNamespaceImports,
        cache,
      });

      if (!importInsight.matched) return { dep, keep: true };
      if (importInsight.hasDynamicImport) return { dep, keep: true };

      if (options.mode === 'aggressive') {
        const bundlers = detectBundlersForProject(sourceProject);
        if (bundlers.length === 0 && !options.fallbackToStaticGraph) {
          return { dep, keep: true };
        }
      }

      if (importInsight.onlyReexports) {
        return {
          dep,
          keep: 'reexport-pending',
          reexport: {
            dep,
            reexportedNames: importInsight.reexportedNames,
            isStarReexport: importInsight.isStarReexport,
            targetMatch,
          },
        };
      }

      return { dep, keep: !importInsight.removable };
    })
  );

  const reexportEdges = phase1Results
    .map((result) => result.reexport)
    .filter((result): result is ReexportEdge => result !== undefined);

  const consumerImports = new Map<string, Map<string, Set<string>>>();

  if (reexportEdges.length > 0) {
    const consumerResults = await Promise.all(
      dependencies
        .filter(
          (dep) =>
            dep.type === 'static' &&
            dep.sourceFile &&
            !dep.sourceFile.endsWith('package.json')
        )
        .map(async (dep) => {
          const sourceFile = dep.sourceFile;
          if (!sourceFile) return;
          const sourceFilePath = join(context.workspaceRoot, sourceFile);
          if (!(await cache.exists(sourceFilePath))) return;

          const targetMatch = targetMatchMap.get(dep.target);
          if (!targetMatch) return;

          const { ast: sourceAst } = await cache.getOrParse(sourceFilePath);
          const importedNames = collectImportedNamesForTarget(
            sourceAst,
            targetMatch,
            options.resolveNamespaceImports
          );

          if (importedNames.size === 0) return;
          return { source: dep.source, target: dep.target, importedNames };
        })
    );

    for (const result of consumerResults) {
      if (!result) continue;
      if (!consumerImports.has(result.source)) {
        consumerImports.set(result.source, new Map());
      }
      const projectMap = consumerImports.get(result.source);
      if (!projectMap) continue;
      if (!projectMap.has(result.target)) {
        projectMap.set(result.target, new Set());
      }
      const names = projectMap.get(result.target);
      if (!names) continue;
      for (const name of result.importedNames) {
        names.add(name);
      }
    }
  }

  const reexportDecisions = await resolveReexportEdges(
    reexportEdges,
    dependencies,
    consumerImports,
    targetMatchMap,
    context,
    cache
  );

  const keptEdges = phase1Results
    .filter(({ dep, keep }) => {
      if (keep === 'reexport-pending') {
        return reexportDecisions.get(dep) ?? true;
      }
      return keep;
    })
    .map(({ dep }) => dep);

  if (options.affectedNarrowing) {
    return applyAffectedNarrowing(
      keptEdges,
      context,
      targetMatchMap,
      cache,
      options
    );
  }

  return keptEdges;
}

type AnalyzeParams = {
  sourceAst: ts.SourceFile;
  sourceText: string;
  sourceFilePath: string;
  targetMatch: TargetMatchData;
  workspaceRoot: string;
  removeTypeOnlyEdges: boolean;
  resolveNamespaceImports: boolean;
  cache: FileCache;
};

async function analyzeImportsForTarget(
  params: AnalyzeParams
): Promise<ImportInsight> {
  const relativeSpecifiers = new Set<string>();

  for (const statement of params.sourceAst.statements) {
    const spec = extractModuleSpecifier(statement, params.sourceAst);
    if (spec?.startsWith('.')) {
      relativeSpecifiers.add(spec);
    }
  }

  ts.forEachChild(params.sourceAst, function collectDynamic(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const spec = node.arguments[0].text;
      if (spec.startsWith('.')) {
        relativeSpecifiers.add(spec);
      }
    }
    ts.forEachChild(node, collectDynamic);
  });

  const resolvedRelativeImports = new Map<string, string | undefined>();
  if (relativeSpecifiers.size > 0) {
    const specs = [...relativeSpecifiers];
    const resolved = await Promise.all(
      specs.map((specifier) =>
        resolveRelativeImport(
          params.sourceFilePath,
          specifier,
          params.workspaceRoot,
          params.cache
        )
      )
    );
    specs.forEach((specifier, index) => {
      resolvedRelativeImports.set(specifier, resolved[index]);
    });
  }

  function matchesTargetImmediate(specifier: string): boolean {
    if (
      params.targetMatch.packageName &&
      specifier === params.targetMatch.packageName
    ) {
      return true;
    }

    if (params.targetMatch.aliases.includes(specifier)) {
      return true;
    }

    if (specifier.startsWith('.')) {
      const resolvedImport = resolvedRelativeImports.get(specifier);
      if (resolvedImport?.startsWith(params.targetMatch.root)) {
        return true;
      }
    }

    return false;
  }

  let matched = false;
  let hasRetainedUsage = false;
  let hasDynamicImport = false;
  let hasReexport = false;
  let isStarReexport = false;
  const reexportedNames: string[] = [];
  let namespaceAccessedProps: Set<string> | undefined;
  const deferredUsageNames: string[] = [];

  for (const statement of params.sourceAst.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier
        .getText(params.sourceAst)
        .slice(1, -1);
      if (!matchesTargetImmediate(specifier)) {
        continue;
      }

      matched = true;

      if (!statement.importClause) {
        hasRetainedUsage = true;
        continue;
      }

      if (statement.importClause.isTypeOnly) {
        if (!params.removeTypeOnlyEdges) {
          hasRetainedUsage = true;
        }
        continue;
      }

      if (
        statement.importClause.namedBindings &&
        ts.isNamespaceImport(statement.importClause.namedBindings)
      ) {
        if (!params.resolveNamespaceImports) {
          hasRetainedUsage = true;
          continue;
        }
        const nsName = statement.importClause.namedBindings.name.text;
        const accessed = collectNamespacePropertyAccesses(
          params.sourceAst,
          nsName
        );
        if (accessed === undefined) {
          hasRetainedUsage = true;
        } else if (accessed.size > 0) {
          namespaceAccessedProps = accessed;
          hasRetainedUsage = true;
        }
        continue;
      }

      const localNames = collectRuntimeImportedNames(statement.importClause);
      if (localNames.length === 0) {
        hasRetainedUsage = true;
        continue;
      }

      deferredUsageNames.push(...localNames);
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const specifier = statement.moduleSpecifier
        .getText(params.sourceAst)
        .slice(1, -1);
      if (matchesTargetImmediate(specifier)) {
        matched = true;
        hasReexport = true;

        if (!statement.exportClause) {
          isStarReexport = true;
        } else if (ts.isNamedExports(statement.exportClause)) {
          for (const element of statement.exportClause.elements) {
            if (!element.isTypeOnly) {
              reexportedNames.push(element.name.text);
            }
          }
        }
      }
    }
  }

  ts.forEachChild(params.sourceAst, function visit(node) {
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteral(node.arguments[0])
    ) {
      const specifier = node.arguments[0].text;
      if (matchesTargetImmediate(specifier)) {
        matched = true;
        hasRetainedUsage = true;
        hasDynamicImport = true;
      }
    }

    ts.forEachChild(node, visit);
  });

  if (deferredUsageNames.length > 0 && !hasRetainedUsage) {
    const counts = countIdentifierOccurrencesBatch(
      params.sourceText,
      deferredUsageNames
    );
    const allUnused = deferredUsageNames.every(
      (name) => (counts.get(name) ?? 0) <= 1
    );
    if (!allUnused) {
      hasRetainedUsage = true;
    }
  }

  return {
    matched,
    removable: matched && !hasRetainedUsage && !hasReexport,
    hasDynamicImport,
    onlyReexports: hasReexport && !hasRetainedUsage && !hasDynamicImport,
    reexportedNames,
    isStarReexport,
    namespaceAccessedProps,
  };
}

function extractModuleSpecifier(
  statement: ts.Statement,
  sourceFile: ts.SourceFile
): string | undefined {
  if (ts.isImportDeclaration(statement)) {
    return statement.moduleSpecifier.getText(sourceFile).slice(1, -1);
  }
  if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
    return statement.moduleSpecifier.getText(sourceFile).slice(1, -1);
  }
  return undefined;
}

function collectRuntimeImportedNames(importClause: ts.ImportClause): string[] {
  const names: string[] = [];

  if (importClause.name) {
    names.push(importClause.name.text);
  }

  if (
    importClause.namedBindings &&
    ts.isNamedImports(importClause.namedBindings)
  ) {
    for (const element of importClause.namedBindings.elements) {
      if (!element.isTypeOnly) {
        names.push(element.name.text);
      }
    }
  }

  return names;
}

function countIdentifierOccurrencesBatch(
  sourceText: string,
  identifiers: string[]
): Map<string, number> {
  const counts = new Map<string, number>();
  if (identifiers.length === 0) return counts;

  for (const identifier of identifiers) {
    counts.set(identifier, 0);
  }

  const escaped = identifiers.map((identifier) =>
    identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  );
  const matcher = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'g');

  let match: RegExpExecArray | null;
  do {
    match = matcher.exec(sourceText);
    if (match !== null) {
      const current = counts.get(match[0]);
      if (current !== undefined) {
        counts.set(match[0], current + 1);
      }
    }
  } while (match !== null);

  return counts;
}

async function resolveRelativeImport(
  sourceFilePath: string,
  specifier: string,
  workspaceRoot: string,
  cache: FileCache
): Promise<string | undefined> {
  const fromDir = dirname(sourceFilePath);
  const baseCandidate = resolve(fromDir, specifier);

  const candidates = [
    baseCandidate,
    `${baseCandidate}.ts`,
    `${baseCandidate}.tsx`,
    `${baseCandidate}.mts`,
    `${baseCandidate}.cts`,
    `${baseCandidate}.js`,
    `${baseCandidate}.mjs`,
    `${baseCandidate}.cjs`,
    join(baseCandidate, 'index.ts'),
    join(baseCandidate, 'index.tsx'),
    join(baseCandidate, 'index.js'),
    join(baseCandidate, 'index.mjs'),
    join(baseCandidate, 'index.cjs'),
  ];

  const results = await Promise.all(
    candidates.map((candidate) => cache.exists(candidate))
  );
  const index = results.findIndex(Boolean);
  return index >= 0 ? toWorkspacePath(candidates[index], workspaceRoot) : undefined;
}

function toWorkspacePath(absolutePath: string, workspaceRoot: string): string {
  return absolutePath
    .replace(workspaceRoot, '')
    .split(/[\\/]/)
    .filter(Boolean)
    .join('/');
}

function scriptKindFromPath(filePath: string): ts.ScriptKind {
  if (filePath.endsWith('.tsx')) {
    return ts.ScriptKind.TSX;
  }
  if (filePath.endsWith('.jsx')) {
    return ts.ScriptKind.JSX;
  }
  return ts.ScriptKind.TS;
}

async function readTsConfigPaths(
  workspaceRoot: string
): Promise<Record<string, string[]>> {
  const tsConfigPath = join(workspaceRoot, 'tsconfig.base.json');

  try {
    const content = await readFile(tsConfigPath, 'utf8');
    const parsed = JSON.parse(content) as {
      compilerOptions?: { paths?: Record<string, string[]> };
    };
    return parsed.compilerOptions?.paths ?? {};
  } catch {
    return {};
  }
}

async function buildTargetMatchMap(
  context: CreateDependenciesContext,
  options: NormalizedOptions
): Promise<Map<string, TargetMatchData>> {
  const tsConfigPaths = await readTsConfigPaths(context.workspaceRoot);

  const entries = await Promise.all(
    Object.entries(context.projects).map(async ([projectName, project]) => {
      const normalizedRoot = project.root.split('\\').join('/');
      const [packageName, sideEffects] = await Promise.all([
        readPackageName(context.workspaceRoot, project.root),
        readSideEffects(
          context.workspaceRoot,
          project.root,
          options.respectSideEffects,
          options.treatMissingPackageJsonAsSideEffectFree
        ),
      ]);

      return [
        projectName,
        {
          target: projectName,
          root: normalizedRoot,
          packageName,
          aliases: aliasesForProject(tsConfigPaths, normalizedRoot),
          sideEffects,
        },
      ] as [string, TargetMatchData];
    })
  );

  return new Map(entries);
}

async function readPackageName(
  workspaceRoot: string,
  projectRoot: string
): Promise<string | undefined> {
  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');

  try {
    const content = await readFile(packageJsonPath, 'utf8');
    const parsed = JSON.parse(content) as { name?: string };
    return parsed.name;
  } catch {
    return undefined;
  }
}

async function readSideEffects(
  workspaceRoot: string,
  projectRoot: string,
  respectSideEffects: boolean,
  treatMissingPackageJsonAsSideEffectFree: boolean
): Promise<boolean> {
  if (!respectSideEffects) {
    return false;
  }

  const packageJsonPath = join(workspaceRoot, projectRoot, 'package.json');

  let content: string;
  try {
    content = await readFile(packageJsonPath, 'utf8');
  } catch {
    return !treatMissingPackageJsonAsSideEffectFree;
  }

  try {
    const parsed = JSON.parse(content) as {
      sideEffects?: boolean | string[];
    };

    return parsed.sideEffects !== false;
  } catch {
    return true;
  }
}

function aliasesForProject(
  tsConfigPaths: Record<string, string[]>,
  projectRoot: string
): string[] {
  const aliases: string[] = [];

  for (const [alias, mappedPaths] of Object.entries(tsConfigPaths)) {
    const belongsToProject = mappedPaths
      .map((mappedPath) => mappedPath.split('\\').join('/').replace(/\*$/, ''))
      .some((mappedPath) => mappedPath.startsWith(projectRoot));

    if (belongsToProject) {
      aliases.push(alias.replace(/\*$/, ''));
    }
  }

  return aliases;
}

type ReexportEdge = {
  dep: RawDependency;
  reexportedNames: string[];
  isStarReexport: boolean;
  targetMatch: TargetMatchData;
};

function collectImportedNamesForTarget(
  sourceAst: ts.SourceFile,
  targetMatch: TargetMatchData,
  resolveNamespaceImports = false
): Set<string> {
  const names = new Set<string>();

  for (const statement of sourceAst.statements) {
    if (ts.isImportDeclaration(statement)) {
      const specifier = statement.moduleSpecifier
        .getText(sourceAst)
        .slice(1, -1);
      if (!matchesAlias(specifier, targetMatch)) continue;

      if (!statement.importClause) {
        names.add('*');
        continue;
      }

      if (
        statement.importClause.namedBindings &&
        ts.isNamespaceImport(statement.importClause.namedBindings)
      ) {
        if (!resolveNamespaceImports) {
          names.add('*');
          continue;
        }
        const nsName = statement.importClause.namedBindings.name.text;
        const accessed = collectNamespacePropertyAccesses(sourceAst, nsName);
        if (accessed === undefined || accessed.size === 0) {
          names.add('*');
        } else {
          for (const prop of accessed) {
            names.add(prop);
          }
        }
        continue;
      }

      if (statement.importClause.name) {
        names.add('default');
      }

      if (
        statement.importClause.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        for (const element of statement.importClause.namedBindings.elements) {
          names.add(element.propertyName?.text ?? element.name.text);
        }
      }
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      const specifier = statement.moduleSpecifier
        .getText(sourceAst)
        .slice(1, -1);
      if (!matchesAlias(specifier, targetMatch)) continue;

      if (!statement.exportClause) {
        names.add('*');
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          names.add(element.propertyName?.text ?? element.name.text);
        }
      }
    }
  }

  return names;
}

function collectNamespacePropertyAccesses(
  sourceAst: ts.SourceFile,
  namespaceName: string
): Set<string> | undefined {
  const props = new Set<string>();
  let unsafeUsage = false;

  function visit(node: ts.Node): void {
    if (unsafeUsage) return;

    if (ts.isIdentifier(node) && node.text === namespaceName) {
      const parent = node.parent;

      if (
        parent &&
        ts.isPropertyAccessExpression(parent) &&
        parent.expression === node
      ) {
        props.add(parent.name.text);
        return;
      }

      if (
        parent &&
        ts.isElementAccessExpression(parent) &&
        parent.expression === node &&
        ts.isStringLiteral(parent.argumentExpression)
      ) {
        props.add(parent.argumentExpression.text);
        return;
      }

      if (parent && ts.isNamespaceImport(parent)) {
        return;
      }

      unsafeUsage = true;
      return;
    }

    ts.forEachChild(node, visit);
  }

  ts.forEachChild(sourceAst, visit);
  return unsafeUsage ? undefined : props;
}

function matchesAlias(specifier: string, targetMatch: TargetMatchData): boolean {
  return (
    (!!targetMatch.packageName && specifier === targetMatch.packageName) ||
    targetMatch.aliases.some(
      (alias) => specifier === alias || specifier.startsWith(alias)
    )
  );
}

async function resolveTargetExportedSymbols(
  targetMatch: TargetMatchData,
  workspaceRoot: string,
  targetMatchMap: Map<string, TargetMatchData> | undefined,
  visited: Set<string> | undefined,
  maxDepth: number | undefined,
  cache: FileCache
): Promise<Set<string> | undefined> {
  const depth = maxDepth ?? 10;
  if (depth <= 0) return undefined;

  const tracked = visited ?? new Set<string>();
  if (tracked.has(targetMatch.target)) return new Set();
  tracked.add(targetMatch.target);

  const entryPath = await findEntryPoint(workspaceRoot, targetMatch.root, cache);
  if (!entryPath) return undefined;

  return resolveExportsFromFile(
    entryPath,
    workspaceRoot,
    targetMatchMap,
    tracked,
    depth,
    cache
  );
}

async function findEntryPoint(
  workspaceRoot: string,
  projectRoot: string,
  cache: FileCache
): Promise<string | undefined> {
  const entryPoints = [
    join(workspaceRoot, projectRoot, 'src', 'index.ts'),
    join(workspaceRoot, projectRoot, 'src', 'index.tsx'),
    join(workspaceRoot, projectRoot, 'src', 'index.js'),
    join(workspaceRoot, projectRoot, 'src', 'index.mjs'),
    join(workspaceRoot, projectRoot, 'index.ts'),
    join(workspaceRoot, projectRoot, 'index.js'),
  ];

  const results = await Promise.all(
    entryPoints.map((entryPoint) => cache.exists(entryPoint))
  );
  const index = results.findIndex(Boolean);
  return index >= 0 ? entryPoints[index] : undefined;
}

async function resolveExportsFromFile(
  filePath: string,
  workspaceRoot: string,
  targetMatchMap: Map<string, TargetMatchData> | undefined,
  visited: Set<string>,
  depth: number,
  cache: FileCache
): Promise<Set<string> | undefined> {
  const { ast: sourceAst } = await cache.getOrParse(filePath);
  const exported = new Set<string>();
  const starExportStatements: ts.ExportDeclaration[] = [];

  for (const statement of sourceAst.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause) {
        starExportStatements.push(statement);
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          exported.add(element.name.text);
        }
      }
      continue;
    }

    if (hasExportModifier(statement)) {
      collectDeclaredNames(statement, exported);
    }
  }

  const starResults = await Promise.all(
    starExportStatements.map((statement) =>
      resolveStarReexportSymbols(
        statement,
        filePath,
        workspaceRoot,
        targetMatchMap,
        new Set(visited),
        depth,
        cache
      )
    )
  );

  for (const resolved of starResults) {
    if (!resolved) {
      return undefined;
    }
    for (const name of resolved) {
      exported.add(name);
    }
  }

  return exported.size > 0 ? exported : undefined;
}

async function resolveStarReexportSymbols(
  statement: ts.ExportDeclaration,
  currentFile: string,
  workspaceRoot: string,
  targetMatchMap: Map<string, TargetMatchData> | undefined,
  visited: Set<string>,
  depth: number,
  cache: FileCache
): Promise<Set<string> | undefined> {
  if (!statement.moduleSpecifier) return undefined;

  const specifier = statement.moduleSpecifier
    .getText(statement.getSourceFile())
    .slice(1, -1);

  if (specifier.startsWith('.')) {
    const resolvedPath = await resolveRelativeImport(
      currentFile,
      specifier,
      workspaceRoot,
      cache
    );
    if (!resolvedPath) return undefined;

    return resolveExportsFromFile(
      join(workspaceRoot, resolvedPath),
      workspaceRoot,
      targetMatchMap,
      visited,
      depth - 1,
      cache
    );
  }

  if (targetMatchMap) {
    const matchingEntry = [...targetMatchMap.values()].find(
      (match) =>
        (match.packageName && specifier === match.packageName) ||
        match.aliases.some(
          (alias) => specifier === alias || specifier.startsWith(alias)
        )
    );

    if (matchingEntry) {
      return resolveTargetExportedSymbols(
        matchingEntry,
        workspaceRoot,
        targetMatchMap,
        visited,
        depth - 1,
        cache
      );
    }
  }

  return undefined;
}

function collectDeclaredNames(statement: ts.Statement, into: Set<string>): void {
  if (ts.isFunctionDeclaration(statement) && statement.name) {
    into.add(statement.name.text);
  } else if (ts.isClassDeclaration(statement) && statement.name) {
    into.add(statement.name.text);
  } else if (ts.isVariableStatement(statement)) {
    for (const declaration of statement.declarationList.declarations) {
      if (ts.isIdentifier(declaration.name)) {
        into.add(declaration.name.text);
      }
    }
  } else if (ts.isEnumDeclaration(statement)) {
    into.add(statement.name.text);
  } else if (ts.isInterfaceDeclaration(statement)) {
    into.add(statement.name.text);
  } else if (ts.isTypeAliasDeclaration(statement)) {
    into.add(statement.name.text);
  }
}

function hasExportModifier(node: ts.Statement): boolean {
  const modifiers: readonly ts.Modifier[] | undefined =
    (node as { modifiers?: readonly ts.Modifier[] }).modifiers ??
    (ts.canHaveModifiers?.(node) ? ts.getModifiers?.(node) : undefined);
  return modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ?? false;
}

async function resolveReexportEdges(
  reexportEdges: ReexportEdge[],
  allDependencies: RawDependency[],
  consumerImports: Map<string, Map<string, Set<string>>>,
  targetMatchMap: Map<string, TargetMatchData>,
  context: CreateDependenciesContext,
  cache: FileCache
): Promise<Map<RawDependency, boolean>> {
  const decisions = new Map<RawDependency, boolean>();
  const consumersOf = new Map<string, Set<string>>();

  for (const dep of allDependencies) {
    if (dep.type !== 'static') continue;
    if (!consumersOf.has(dep.target)) {
      consumersOf.set(dep.target, new Set());
    }
    consumersOf.get(dep.target)?.add(dep.source);
  }

  const results = await Promise.all(
    reexportEdges.map(async (edge) => {
      const consumers = consumersOf.get(edge.dep.source);
      if (!consumers || consumers.size === 0) {
        return { dep: edge.dep, keep: false };
      }

      const relevantSymbols = edge.isStarReexport
        ? await resolveTargetExportedSymbols(
            edge.targetMatch,
            context.workspaceRoot,
            targetMatchMap,
            undefined,
            undefined,
            cache
          )
        : new Set(edge.reexportedNames);

      if (!relevantSymbols) {
        return { dep: edge.dep, keep: true };
      }

      return {
        dep: edge.dep,
        keep: anyConsumerUsesSymbols(
          edge.dep.source,
          relevantSymbols,
          consumersOf,
          consumerImports,
          new Set<string>()
        ),
      };
    })
  );

  for (const result of results) {
    decisions.set(result.dep, result.keep);
  }

  return decisions;
}

function anyConsumerUsesSymbols(
  project: string,
  relevantSymbols: Set<string>,
  consumersOf: Map<string, Set<string>>,
  consumerImports: Map<string, Map<string, Set<string>>>,
  visited: Set<string>
): boolean {
  if (visited.has(project)) return false;
  visited.add(project);

  const consumers = consumersOf.get(project);
  if (!consumers || consumers.size === 0) return false;

  for (const consumer of consumers) {
    const projectMap = consumerImports.get(consumer);
    if (!projectMap) continue;

    const importedNames = projectMap.get(project);
    if (!importedNames) continue;

    for (const name of importedNames) {
      if (name !== '*' && relevantSymbols.has(name)) {
        return true;
      }
    }

    if (
      importedNames.has('*') &&
      anyConsumerUsesSymbols(
        consumer,
        relevantSymbols,
        consumersOf,
        consumerImports,
        visited
      )
    ) {
      return true;
    }
  }

  return false;
}

async function resolveMergeBase(
  workspaceRoot: string,
  base: string,
  head: string
): Promise<string> {
  try {
    const { stdout } = await execFileAsync(
      'git',
      ['merge-base', '--fork-point', base, head],
      { cwd: workspaceRoot, maxBuffer: 10 * 1024 * 1024 }
    );
    return stdout.trim() || base;
  } catch {
    return base;
  }
}

async function getGitDiffFiles(
  workspaceRoot: string,
  base: string,
  head: string
): Promise<string[]> {
  try {
    const resolvedBase = head
      ? await resolveMergeBase(workspaceRoot, base, head)
      : base;
    const args = ['diff', '--name-only', '--no-renames', '--relative', resolvedBase];
    if (head) {
      args.push(head);
    }
    const { stdout } = await execFileAsync('git', args, {
      cwd: workspaceRoot,
      maxBuffer: 10 * 1024 * 1024,
    });
    return stdout
      .trim()
      .split('\n')
      .filter((line) => line.length > 0);
  } catch {
    return [];
  }
}

function mapFilesToProjects(
  changedFiles: string[],
  projects: CreateDependenciesContext['projects']
): Map<string, string[]> {
  const result = new Map<string, string[]>();
  const sortedProjects = Object.entries(projects).sort(
    ([, left], [, right]) => right.root.length - left.root.length
  );

  for (const file of changedFiles) {
    const normalized = file.split('\\').join('/');
    for (const [projectName, project] of sortedProjects) {
      const root = project.root.split('\\').join('/');
      if (normalized.startsWith(root + '/') || normalized === root) {
        const existing = result.get(projectName);
        if (existing) {
          existing.push(normalized);
        } else {
          result.set(projectName, [normalized]);
        }
        break;
      }
    }
  }

  return result;
}

async function resolveExportOriginsFromFile(
  filePath: string,
  workspaceRoot: string,
  visited: Set<string>,
  cache: FileCache
): Promise<Map<string, Set<string>>> {
  const origins = new Map<string, Set<string>>();

  if (visited.has(filePath) || !(await cache.exists(filePath))) {
    return origins;
  }
  visited.add(filePath);

  const { ast: sourceAst } = await cache.getOrParse(filePath);
  const workspaceRelative = relative(workspaceRoot, filePath).split('\\').join('/');

  type NamedReexport = {
    spec: string;
    elements: ts.ExportSpecifier[];
  };

  const starReexportSpecs: string[] = [];
  const namedReexportSpecs: NamedReexport[] = [];

  for (const statement of sourceAst.statements) {
    if (ts.isExportDeclaration(statement)) {
      if (!statement.exportClause && statement.moduleSpecifier) {
        const spec = statement.moduleSpecifier
          .getText(sourceAst)
          .slice(1, -1);
        if (spec.startsWith('.')) {
          starReexportSpecs.push(spec);
        }
      } else if (
        statement.exportClause &&
        ts.isNamedExports(statement.exportClause)
      ) {
        if (statement.moduleSpecifier) {
          const spec = statement.moduleSpecifier
            .getText(sourceAst)
            .slice(1, -1);
          if (spec.startsWith('.')) {
            namedReexportSpecs.push({
              spec,
              elements: [...statement.exportClause.elements],
            });
          } else {
            for (const element of statement.exportClause.elements) {
              addOrigin(origins, element.name.text, workspaceRelative);
            }
          }
        } else {
          for (const element of statement.exportClause.elements) {
            addOrigin(origins, element.name.text, workspaceRelative);
          }
        }
      }
      continue;
    }

    if (hasExportModifier(statement)) {
      const names = new Set<string>();
      collectDeclaredNames(statement, names);
      for (const name of names) {
        addOrigin(origins, name, workspaceRelative);
      }
    }

    if (ts.isExportAssignment(statement)) {
      addOrigin(origins, 'default', workspaceRelative);
    }
  }

  const namedResolvedPaths = await Promise.all(
    namedReexportSpecs.map(({ spec }) =>
      resolveRelativeImport(filePath, spec, workspaceRoot, cache)
    )
  );

  const namedSubOrigins = await Promise.all(
    namedResolvedPaths.map((resolvedPath) => {
      if (!resolvedPath) {
        return Promise.resolve(new Map<string, Set<string>>());
      }
      return resolveExportOriginsFromFile(
        join(workspaceRoot, resolvedPath),
        workspaceRoot,
        new Set(visited),
        cache
      );
    })
  );

  for (const [index, { elements }] of namedReexportSpecs.entries()) {
    const resolvedPath = namedResolvedPaths[index];
    const subOrigins = namedSubOrigins[index];
    if (!resolvedPath) continue;

    for (const element of elements) {
      const originalName = element.propertyName?.text ?? element.name.text;
      const exportName = element.name.text;
      const sub = subOrigins.get(originalName);
      if (sub) {
        addOriginSet(origins, exportName, sub);
      } else {
        addOrigin(origins, exportName, resolvedPath);
      }
    }
  }

  const starResolvedPaths = await Promise.all(
    starReexportSpecs.map((spec) =>
      resolveRelativeImport(filePath, spec, workspaceRoot, cache)
    )
  );

  const starSubOrigins = await Promise.all(
    starResolvedPaths.map((resolvedPath) => {
      if (!resolvedPath) {
        return Promise.resolve(new Map<string, Set<string>>());
      }
      return resolveExportOriginsFromFile(
        join(workspaceRoot, resolvedPath),
        workspaceRoot,
        new Set(visited),
        cache
      );
    })
  );

  for (const subOrigins of starSubOrigins) {
    for (const [name, files] of subOrigins) {
      addOriginSet(origins, name, files);
    }
  }

  return origins;
}

function addOrigin(
  map: Map<string, Set<string>>,
  name: string,
  file: string
): void {
  const existing = map.get(name);
  if (existing) {
    existing.add(file);
  } else {
    map.set(name, new Set([file]));
  }
}

function addOriginSet(
  map: Map<string, Set<string>>,
  name: string,
  files: Set<string>
): void {
  const existing = map.get(name);
  if (existing) {
    for (const file of files) {
      existing.add(file);
    }
  } else {
    map.set(name, new Set(files));
  }
}

async function collectImportedNamesViaRelativePaths(
  sourceAst: ts.SourceFile,
  sourceFilePath: string,
  targetMatch: TargetMatchData,
  workspaceRoot: string,
  cache: FileCache,
  resolveNamespaceImports: boolean
): Promise<Set<string>> {
  const names = new Set<string>();
  const relativeSpecs: Array<{ spec: string; statement: ts.Statement }> = [];

  for (const statement of sourceAst.statements) {
    const spec = extractModuleSpecifier(statement, sourceAst);
    if (spec?.startsWith('.')) {
      relativeSpecs.push({ spec, statement });
    }
  }

  if (relativeSpecs.length === 0) {
    return names;
  }

  const resolved = await Promise.all(
    relativeSpecs.map(({ spec }) =>
      resolveRelativeImport(sourceFilePath, spec, workspaceRoot, cache)
    )
  );
  const normalizedRoot = targetMatch.root.split('\\').join('/');

  for (let index = 0; index < relativeSpecs.length; index += 1) {
    const workspaceRelative = resolved[index];
    if (!workspaceRelative || !workspaceRelative.startsWith(normalizedRoot + '/')) {
      continue;
    }

    const { statement } = relativeSpecs[index];
    if (ts.isImportDeclaration(statement)) {
      if (!statement.importClause) {
        names.add('*');
        continue;
      }

      if (
        statement.importClause.namedBindings &&
        ts.isNamespaceImport(statement.importClause.namedBindings)
      ) {
        if (!resolveNamespaceImports) {
          names.add('*');
          continue;
        }
        const nsName = statement.importClause.namedBindings.name.text;
        const accessed = collectNamespacePropertyAccesses(sourceAst, nsName);
        if (accessed === undefined || accessed.size === 0) {
          names.add('*');
        } else {
          for (const prop of accessed) {
            names.add(prop);
          }
        }
        continue;
      }

      if (statement.importClause.name) {
        names.add('default');
      }

      if (
        statement.importClause.namedBindings &&
        ts.isNamedImports(statement.importClause.namedBindings)
      ) {
        for (const element of statement.importClause.namedBindings.elements) {
          names.add(element.propertyName?.text ?? element.name.text);
        }
      }
      continue;
    }

    if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
      if (!statement.exportClause) {
        names.add('*');
      } else if (ts.isNamedExports(statement.exportClause)) {
        for (const element of statement.exportClause.elements) {
          names.add(element.propertyName?.text ?? element.name.text);
        }
      }
    }
  }

  return names;
}

async function applyAffectedNarrowing(
  keptEdges: RawDependency[],
  context: CreateDependenciesContext,
  targetMatchMap: Map<string, TargetMatchData>,
  cache: FileCache,
  options: NormalizedOptions
): Promise<RawDependency[]> {
  const base = process.env['NX_BASE'];
  if (!base) {
    return keptEdges;
  }

  const head = process.env['NX_HEAD'] ?? '';
  const changedFiles = await getGitDiffFiles(context.workspaceRoot, base, head);
  if (changedFiles.length === 0) {
    return keptEdges;
  }

  const touchedProjects = mapFilesToProjects(changedFiles, context.projects);
  if (touchedProjects.size === 0) {
    return keptEdges;
  }

  const originMapEntries = await Promise.all(
    [...touchedProjects.keys()].map(async (projectName) => {
      const targetMatch = targetMatchMap.get(projectName);
      if (!targetMatch) {
        return;
      }

      const entryPath = await findEntryPoint(
        context.workspaceRoot,
        targetMatch.root,
        cache
      );
      if (!entryPath) {
        return;
      }

      const originMap = await resolveExportOriginsFromFile(
        entryPath,
        context.workspaceRoot,
        new Set<string>(),
        cache
      );
      if (originMap.size === 0) {
        return;
      }

      return { projectName, originMap };
    })
  );

  const exportOriginMaps = new Map<string, Map<string, Set<string>>>();
  for (const entry of originMapEntries) {
    if (entry) {
      exportOriginMaps.set(entry.projectName, entry.originMap);
    }
  }

  const edgesToCheck: RawDependency[] = [];
  const unconditionallyKept: RawDependency[] = [];

  for (const edge of keptEdges) {
    if (edge.type === 'static' && touchedProjects.has(edge.target)) {
      edgesToCheck.push(edge);
    } else {
      unconditionallyKept.push(edge);
    }
  }

  const decisions = await Promise.all(
    edgesToCheck.map(async (edge) => {
      const changedFilesInTarget = touchedProjects.get(edge.target);
      if (!changedFilesInTarget || changedFilesInTarget.length === 0) {
        return { edge, keep: true };
      }

      const targetMatch = targetMatchMap.get(edge.target);
      if (!targetMatch || !edge.sourceFile) {
        return { edge, keep: true };
      }

      const sourceFilePath = join(context.workspaceRoot, edge.sourceFile);
      if (!(await cache.exists(sourceFilePath))) {
        return { edge, keep: true };
      }

      const { ast: sourceAst } = await cache.getOrParse(sourceFilePath);
      let importedNames = collectImportedNamesForTarget(
        sourceAst,
        targetMatch,
        options.resolveNamespaceImports
      );

      if (importedNames.size === 0) {
        importedNames = await collectImportedNamesViaRelativePaths(
          sourceAst,
          sourceFilePath,
          targetMatch,
          context.workspaceRoot,
          cache,
          options.resolveNamespaceImports
        );
      }

      if (importedNames.has('*') || importedNames.size === 0) {
        return { edge, keep: true };
      }

      const exportOriginMap = exportOriginMaps.get(edge.target);
      if (!exportOriginMap) {
        return { edge, keep: true };
      }

      const changedFilesSet = new Set(changedFilesInTarget);
      for (const symbolName of importedNames) {
        const originFiles = exportOriginMap.get(symbolName);
        if (!originFiles) {
          return { edge, keep: true };
        }
        for (const originFile of originFiles) {
          if (changedFilesSet.has(originFile)) {
            return { edge, keep: true };
          }
        }
      }

      return { edge, keep: false };
    })
  );

  const result = [...unconditionallyKept];
  for (const decision of decisions) {
    if (decision.keep) {
      result.push(decision.edge);
    }
  }

  return result;
}