import { join, relative, resolve, dirname } from 'node:path';
import ts from 'typescript';
import type { TargetMatchData } from '../types';
import { FileCache } from './file-cache';

export class ExportGraphResolver {
  constructor(
    private readonly workspaceRoot: string,
    private readonly cache: FileCache
  ) {}

  async resolveRelativeImport(
    sourceFilePath: string,
    specifier: string
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
      candidates.map((candidate) => this.cache.isFile(candidate))
    );
    const index = results.findIndex(Boolean);

    return index >= 0 ? this.toWorkspacePath(candidates[index]) : undefined;
  }

  async findEntryPoint(projectRoot: string): Promise<string | undefined> {
    const entryPoints = [
      join(this.workspaceRoot, projectRoot, 'src', 'index.ts'),
      join(this.workspaceRoot, projectRoot, 'src', 'index.tsx'),
      join(this.workspaceRoot, projectRoot, 'src', 'index.js'),
      join(this.workspaceRoot, projectRoot, 'src', 'index.mjs'),
      join(this.workspaceRoot, projectRoot, 'index.ts'),
      join(this.workspaceRoot, projectRoot, 'index.js'),
    ];

    const results = await Promise.all(
      entryPoints.map((entryPoint) => this.cache.isFile(entryPoint))
    );
    const index = results.findIndex(Boolean);

    return index >= 0 ? entryPoints[index] : undefined;
  }

  async resolveTargetExportedSymbols(
    targetMatch: TargetMatchData,
    targetMatchMap?: Map<string, TargetMatchData>,
    visited?: Set<string>,
    maxDepth = 10
  ): Promise<Set<string> | undefined> {
    if (maxDepth <= 0) {
      return undefined;
    }

    const tracked = visited ?? new Set<string>();
    if (tracked.has(targetMatch.target)) {
      return new Set();
    }
    tracked.add(targetMatch.target);

    const entryPath = await this.findEntryPoint(targetMatch.root);
    if (!entryPath) {
      return undefined;
    }

    try {
      return await this.resolveExportsFromFile(
        entryPath,
        targetMatchMap,
        tracked,
        maxDepth
      );
    } catch {
      return undefined;
    }
  }

  anyConsumerUsesSymbols(
    project: string,
    relevantSymbols: Set<string>,
    consumersOf: Map<string, Set<string>>,
    consumerImports: Map<string, Map<string, Set<string>>>,
    visited: Set<string>
  ): boolean {
    if (visited.has(project)) {
      return false;
    }
    visited.add(project);

    const consumers = consumersOf.get(project);
    if (!consumers || consumers.size === 0) {
      return false;
    }

    for (const consumer of consumers) {
      const projectMap = consumerImports.get(consumer);
      if (!projectMap) {
        continue;
      }

      const importedNames = projectMap.get(project);
      if (!importedNames) {
        continue;
      }

      for (const name of importedNames) {
        if (name !== '*' && relevantSymbols.has(name)) {
          return true;
        }
      }

      if (
        importedNames.has('*') &&
        this.anyConsumerUsesSymbols(
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

  async resolveExportOriginsFromFile(
    filePath: string,
    visited: Set<string>
  ): Promise<Map<string, Set<string>>> {
    const origins = new Map<string, Set<string>>();

    if (visited.has(filePath) || !(await this.cache.exists(filePath))) {
      return origins;
    }
    visited.add(filePath);

    const { ast: sourceAst } = await this.cache.getOrParse(filePath);
    const workspaceRelative = relative(this.workspaceRoot, filePath)
      .split('\\')
      .join('/');

    type NamedReexport = {
      spec: string;
      elements: ts.ExportSpecifier[];
    };

    const starReexportSpecs: string[] = [];
    const namedReexportSpecs: NamedReexport[] = [];

    for (const statement of sourceAst.statements) {
      if (ts.isExportDeclaration(statement)) {
        if (!statement.exportClause && statement.moduleSpecifier) {
          const spec = statement.moduleSpecifier.getText(sourceAst).slice(1, -1);
          if (spec.startsWith('.')) {
            starReexportSpecs.push(spec);
          }
        } else if (
          statement.exportClause &&
          ts.isNamedExports(statement.exportClause)
        ) {
          if (statement.moduleSpecifier) {
            const spec = statement.moduleSpecifier.getText(sourceAst).slice(1, -1);
            if (spec.startsWith('.')) {
              namedReexportSpecs.push({
                spec,
                elements: [...statement.exportClause.elements],
              });
            } else {
              for (const element of statement.exportClause.elements) {
                this.addOrigin(origins, element.name.text, workspaceRelative);
              }
            }
          } else {
            for (const element of statement.exportClause.elements) {
              this.addOrigin(origins, element.name.text, workspaceRelative);
            }
          }
        }
        continue;
      }

      if (this.hasExportModifier(statement)) {
        const names = new Set<string>();
        this.collectDeclaredNames(statement, names);
        for (const name of names) {
          this.addOrigin(origins, name, workspaceRelative);
        }
      }

      if (ts.isExportAssignment(statement)) {
        this.addOrigin(origins, 'default', workspaceRelative);
      }
    }

    const namedResolvedPaths = await Promise.all(
      namedReexportSpecs.map(({ spec }) => this.resolveRelativeImport(filePath, spec))
    );
    const namedSubOrigins = await Promise.all(
      namedResolvedPaths.map((resolvedPath) => {
        if (!resolvedPath) {
          return Promise.resolve(new Map<string, Set<string>>());
        }

        return this.resolveExportOriginsFromFile(
          join(this.workspaceRoot, resolvedPath),
          new Set(visited)
        );
      })
    );

    for (const [index, { elements }] of namedReexportSpecs.entries()) {
      const resolvedPath = namedResolvedPaths[index];
      const subOrigins = namedSubOrigins[index];
      if (!resolvedPath) {
        continue;
      }

      for (const element of elements) {
        const originalName = element.propertyName?.text ?? element.name.text;
        const exportName = element.name.text;
        const sub = subOrigins.get(originalName);

        if (sub) {
          this.addOriginSet(origins, exportName, sub);
        } else {
          this.addOrigin(origins, exportName, resolvedPath);
        }
      }
    }

    const starResolvedPaths = await Promise.all(
      starReexportSpecs.map((spec) => this.resolveRelativeImport(filePath, spec))
    );
    const starSubOrigins = await Promise.all(
      starResolvedPaths.map((resolvedPath) => {
        if (!resolvedPath) {
          return Promise.resolve(new Map<string, Set<string>>());
        }

        return this.resolveExportOriginsFromFile(
          join(this.workspaceRoot, resolvedPath),
          new Set(visited)
        );
      })
    );

    for (const subOrigins of starSubOrigins) {
      for (const [name, files] of subOrigins) {
        this.addOriginSet(origins, name, files);
      }
    }

    return origins;
  }

  private async resolveExportsFromFile(
    filePath: string,
    targetMatchMap: Map<string, TargetMatchData> | undefined,
    visited: Set<string>,
    depth: number
  ): Promise<Set<string> | undefined> {
    const { ast: sourceAst } = await this.cache.getOrParse(filePath);
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

      if (this.hasExportModifier(statement)) {
        this.collectDeclaredNames(statement, exported);
      }
    }

    const starResults = await Promise.all(
      starExportStatements.map((statement) =>
        this.resolveStarReexportSymbols(
          statement,
          filePath,
          targetMatchMap,
          new Set(visited),
          depth
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

  private async resolveStarReexportSymbols(
    statement: ts.ExportDeclaration,
    currentFile: string,
    targetMatchMap: Map<string, TargetMatchData> | undefined,
    visited: Set<string>,
    depth: number
  ): Promise<Set<string> | undefined> {
    if (!statement.moduleSpecifier) {
      return undefined;
    }

    const specifier = statement.moduleSpecifier
      .getText(statement.getSourceFile())
      .slice(1, -1);

    if (specifier.startsWith('.')) {
      const resolvedPath = await this.resolveRelativeImport(currentFile, specifier);
      if (!resolvedPath) {
        return undefined;
      }

      const absolutePath = join(this.workspaceRoot, resolvedPath);
      if (!(await this.cache.exists(absolutePath))) {
        return undefined;
      }

      return this.resolveExportsFromFile(
        absolutePath,
        targetMatchMap,
        visited,
        depth - 1
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
        return this.resolveTargetExportedSymbols(
          matchingEntry,
          targetMatchMap,
          visited,
          depth - 1
        );
      }
    }

    return undefined;
  }

  private toWorkspacePath(absolutePath: string): string {
    const relativePath = absolutePath.replace(this.workspaceRoot, '');
    return relativePath
      .split(/[\\/]/)
      .filter(Boolean)
      .join('/');
  }

  private collectDeclaredNames(statement: ts.Statement, into: Set<string>): void {
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

  private hasExportModifier(node: ts.Statement): boolean {
    const modifiers: readonly ts.Modifier[] | undefined =
      (node as { modifiers?: readonly ts.Modifier[] }).modifiers ??
      (ts.canHaveModifiers?.(node) ? ts.getModifiers?.(node) : undefined);

    return (
      modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword) ??
      false
    );
  }

  private addOrigin(
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

  private addOriginSet(
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
}