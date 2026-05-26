import ts from 'typescript';
import type { ImportInsight, TargetMatchData } from '../types';
import { FileCache } from './file-cache';
import { ExportGraphResolver } from './export-graph-resolver';

type AnalyzeImportsParams = {
  sourceAst: ts.SourceFile;
  sourceText: string;
  sourceFilePath: string;
  targetMatch: TargetMatchData;
  removeTypeOnlyEdges: boolean;
  resolveNamespaceImports: boolean;
};

export class ImportUsageAnalyzer {
  constructor(
    private readonly cache: FileCache,
    private readonly exportGraphResolver: ExportGraphResolver
  ) {}

  async analyzeImportsForTarget(
    params: AnalyzeImportsParams
  ): Promise<ImportInsight> {
    const relativeSpecifiers = new Set<string>();

    for (const statement of params.sourceAst.statements) {
      const specifier = this.extractModuleSpecifier(statement, params.sourceAst);
      if (specifier?.startsWith('.')) {
        relativeSpecifiers.add(specifier);
      }
    }

    ts.forEachChild(params.sourceAst, function collectDynamic(node) {
      if (
        ts.isCallExpression(node) &&
        node.expression.kind === ts.SyntaxKind.ImportKeyword &&
        node.arguments.length === 1 &&
        ts.isStringLiteral(node.arguments[0])
      ) {
        const specifier = node.arguments[0].text;
        if (specifier.startsWith('.')) {
          relativeSpecifiers.add(specifier);
        }
      }

      ts.forEachChild(node, collectDynamic);
    });

    const resolvedRelativeImports = new Map<string, string | undefined>();
    if (relativeSpecifiers.size > 0) {
      const specifiers = [...relativeSpecifiers];
      const resolved = await Promise.all(
        specifiers.map((specifier) =>
          this.exportGraphResolver.resolveRelativeImport(
            params.sourceFilePath,
            specifier
          )
        )
      );

      specifiers.forEach((specifier, index) => {
        resolvedRelativeImports.set(specifier, resolved[index]);
      });
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
        if (!this.matchesTargetImport(specifier, params.targetMatch, resolvedRelativeImports)) {
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

          const namespaceName = statement.importClause.namedBindings.name.text;
          const accessed = this.collectNamespacePropertyAccesses(
            params.sourceAst,
            namespaceName
          );

          if (accessed === undefined) {
            hasRetainedUsage = true;
          } else if (accessed.size > 0) {
            namespaceAccessedProps = accessed;
            hasRetainedUsage = true;
          }
          continue;
        }

        const localNames = this.collectRuntimeImportedNames(statement.importClause);
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

        if (this.matchesTargetImport(specifier, params.targetMatch, resolvedRelativeImports)) {
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

    const matchesTargetImmediate = (specifier: string) =>
      this.matchesTargetImport(specifier, params.targetMatch, resolvedRelativeImports);

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
      const counts = this.countIdentifierOccurrencesBatch(
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

  collectImportedNamesForTarget(
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
        if (!this.matchesAlias(specifier, targetMatch)) {
          continue;
        }

        this.collectImportedNamesFromMatchedStatement(
          names,
          statement,
          sourceAst,
          resolveNamespaceImports
        );
        continue;
      }

      if (ts.isExportDeclaration(statement) && statement.moduleSpecifier) {
        const specifier = statement.moduleSpecifier
          .getText(sourceAst)
          .slice(1, -1);
        if (!this.matchesAlias(specifier, targetMatch)) {
          continue;
        }

        this.collectImportedNamesFromMatchedStatement(
          names,
          statement,
          sourceAst,
          resolveNamespaceImports
        );
      }
    }

    return names;
  }

  async getImportedNamesForEdgeSourceTarget(
    sourceFilePath: string,
    targetMatch: TargetMatchData,
    resolveNamespaceImports: boolean,
    importedNamesCache: Map<string, Promise<Set<string>>>
  ): Promise<Set<string>> {
    const cacheKey = `${sourceFilePath}::${targetMatch.target}::${
      resolveNamespaceImports ? '1' : '0'
    }`;
    const existing = importedNamesCache.get(cacheKey);
    if (existing) {
      return existing;
    }

    const pending = (async () => {
      const { ast: sourceAst } = await this.cache.getOrParse(sourceFilePath);
      let importedNames = this.collectImportedNamesForTarget(
        sourceAst,
        targetMatch,
        resolveNamespaceImports
      );

      if (importedNames.size === 0) {
        importedNames = await this.collectImportedNamesViaRelativePaths(
          sourceAst,
          sourceFilePath,
          targetMatch,
          resolveNamespaceImports
        );
      }

      return importedNames;
    })();

    importedNamesCache.set(cacheKey, pending);
    return pending;
  }

  private extractModuleSpecifier(
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

  private matchesTargetImport(
    specifier: string,
    targetMatch: TargetMatchData,
    resolvedRelativeImports: Map<string, string | undefined>
  ): boolean {
    if (targetMatch.packageName && specifier === targetMatch.packageName) {
      return true;
    }

    if (targetMatch.aliases.includes(specifier)) {
      return true;
    }

    if (specifier.startsWith('.')) {
      const resolvedImport = resolvedRelativeImports.get(specifier);
      if (resolvedImport?.startsWith(targetMatch.root)) {
        return true;
      }
    }

    return false;
  }

  private matchesAlias(specifier: string, targetMatch: TargetMatchData): boolean {
    return (
      (!!targetMatch.packageName && specifier === targetMatch.packageName) ||
      targetMatch.aliases.some(
        (alias) => specifier === alias || specifier.startsWith(alias)
      )
    );
  }

  private collectNamespacePropertyAccesses(
    sourceAst: ts.SourceFile,
    namespaceName: string
  ): Set<string> | undefined {
    const props = new Set<string>();
    let unsafeUsage = false;

    const visit = (node: ts.Node): void => {
      if (unsafeUsage) {
        return;
      }

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
    };

    ts.forEachChild(sourceAst, visit);
    return unsafeUsage ? undefined : props;
  }

  private collectRuntimeImportedNames(importClause: ts.ImportClause): string[] {
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

  private countIdentifierOccurrencesBatch(
    sourceText: string,
    identifiers: string[]
  ): Map<string, number> {
    const counts = new Map<string, number>();
    if (identifiers.length === 0) {
      return counts;
    }

    for (const identifier of identifiers) {
      counts.set(identifier, 0);
    }

    const escaped = identifiers.map((identifier) =>
      identifier.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    );
    const matcher = new RegExp(`\\b(?:${escaped.join('|')})\\b`, 'g');

    let match: RegExpExecArray | null;
    while ((match = matcher.exec(sourceText)) !== null) {
      const current = counts.get(match[0]);
      if (current !== undefined) {
        counts.set(match[0], current + 1);
      }
    }

    return counts;
  }

  private async collectImportedNamesViaRelativePaths(
    sourceAst: ts.SourceFile,
    sourceFilePath: string,
    targetMatch: TargetMatchData,
    resolveNamespaceImports: boolean
  ): Promise<Set<string>> {
    const names = new Set<string>();
    const relativeSpecs: Array<{ spec: string; statement: ts.Statement }> = [];

    for (const statement of sourceAst.statements) {
      const specifier = this.extractModuleSpecifier(statement, sourceAst);
      if (specifier?.startsWith('.')) {
        relativeSpecs.push({ spec: specifier, statement });
      }
    }

    if (relativeSpecs.length === 0) {
      return names;
    }

    const resolved = await Promise.all(
      relativeSpecs.map(({ spec }) =>
        this.exportGraphResolver.resolveRelativeImport(sourceFilePath, spec)
      )
    );
    const normalizedRoot = targetMatch.root.split('\\').join('/');

    for (let index = 0; index < relativeSpecs.length; index += 1) {
      const workspaceRelative = resolved[index];
      if (
        !workspaceRelative ||
        !workspaceRelative.startsWith(normalizedRoot + '/')
      ) {
        continue;
      }

      this.collectImportedNamesFromMatchedStatement(
        names,
        relativeSpecs[index].statement,
        sourceAst,
        resolveNamespaceImports
      );
    }

    return names;
  }

  private collectImportedNamesFromMatchedStatement(
    names: Set<string>,
    statement: ts.Statement,
    sourceAst: ts.SourceFile,
    resolveNamespaceImports: boolean
  ): void {
    if (ts.isImportDeclaration(statement)) {
      if (!statement.importClause) {
        names.add('*');
        return;
      }

      if (
        statement.importClause.namedBindings &&
        ts.isNamespaceImport(statement.importClause.namedBindings)
      ) {
        if (!resolveNamespaceImports) {
          names.add('*');
          return;
        }

        const namespaceName = statement.importClause.namedBindings.name.text;
        const accessed = this.collectNamespacePropertyAccesses(sourceAst, namespaceName);
        if (accessed === undefined || accessed.size === 0) {
          names.add('*');
        } else {
          for (const prop of accessed) {
            names.add(prop);
          }
        }
        return;
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
      return;
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
}