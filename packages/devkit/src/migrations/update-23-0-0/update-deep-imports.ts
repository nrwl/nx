import { logger, type Tree } from 'nx/src/devkit-exports';
import type {
  ImportDeclaration,
  ImportSpecifier,
  NamedImports,
  SourceFile,
} from 'typescript';
import { formatFiles } from '../../generators/format-files';
import { visitNotIgnoredFiles } from '../../generators/visit-not-ignored-files';
import { ensurePackage } from '../../utils/package-json';
import {
  applyChangesToString,
  ChangeType,
  type StringChange,
} from '../../utils/string-change';
import { typescriptVersion } from '../../utils/versions';

const TS_EXTENSIONS = ['.ts', '.tsx', '.cts', '.mts'] as const;
const DEEP_IMPORT_PREFIX = '@nx/devkit/src/';
const PUBLIC_SPECIFIER = '@nx/devkit';
const INTERNAL_SPECIFIER = '@nx/devkit/internal';

// Names re-exported from `@nx/devkit/internal` (see packages/devkit/internal.ts
// at the time this migration was authored). Anything imported from a
// `@nx/devkit/src/...` path whose name is NOT in this set is assumed to be
// part of the stable public `@nx/devkit` API.
export const DEVKIT_INTERNAL_SYMBOLS: ReadonlySet<string> = new Set([
  'signalToCode',
  'createProjectRootMappingsFromProjectConfigurations',
  'PluginCache',
  'safeWriteFileCache',
  'determineArtifactNameAndDirectoryOptions',
  'getRelativeCwd',
  'FileExtensionType',
  'getE2EWebServerInfo',
  'E2EWebServerDetails',
  'forEachExecutorOptions',
  'AggregatedLog',
  'migrateProjectExecutorsToPlugin',
  'migrateProjectExecutorsToPluginV1',
  'NoTargetsToMigrateError',
  'InferredTargetConfiguration',
  'processTargetOutputs',
  'deleteMatchingProperties',
  'toProjectRelativePath',
  'determineProjectNameAndRootOptions',
  'ensureRootProjectName',
  'resolveImportPath',
  'promptWhenInteractive',
  'addBuildTargetDefaults',
  'addE2eCiTargetDefaults',
  'addPlugin',
  'createAsyncIterable',
  'combineAsyncIterables',
  'mapAsyncIterable',
  'calculateHashForCreateNodes',
  'calculateHashesForCreateNodes',
  'getCatalogManager',
  'loadConfigFile',
  'clearRequireCache',
  'findPluginForConfigFile',
  'getNamedInputs',
  'logShowProjectCommand',
  'eachValueFrom',
  'checkAndCleanWithSemver',
  'camelize',
  'capitalize',
  'classify',
  'dasherize',
]);

const FALLBACK_RE = /(['"])@nx\/devkit\/src\/[^'"\n]+?\1/g;

let ts: typeof import('typescript') | undefined;

export default async function updateDevkitDeepImports(
  tree: Tree
): Promise<void> {
  let touchedCount = 0;

  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (!TS_EXTENSIONS.some((ext) => filePath.endsWith(ext))) {
      return;
    }
    const original = tree.read(filePath, 'utf-8');
    if (!original || !original.includes(DEEP_IMPORT_PREFIX)) {
      return;
    }
    const updated = rewriteDevkitDeepImports(original);
    if (updated !== original) {
      tree.write(filePath, updated);
      touchedCount += 1;
    }
  });

  if (touchedCount > 0) {
    logger.info(`Rewrote @nx/devkit deep imports in ${touchedCount} file(s).`);
  }

  await formatFiles(tree);
}

export function rewriteDevkitDeepImports(source: string): string {
  ts ??= ensurePackage<typeof import('typescript')>(
    'typescript',
    typescriptVersion
  );
  const sourceFile = ts.createSourceFile(
    'tmp.ts',
    source,
    ts.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts.ScriptKind.TSX
  );

  const changes: StringChange[] = [];
  for (const stmt of sourceFile.statements) {
    if (!ts.isImportDeclaration(stmt)) continue;
    if (!ts.isStringLiteral(stmt.moduleSpecifier)) continue;
    if (!stmt.moduleSpecifier.text.startsWith(DEEP_IMPORT_PREFIX)) continue;

    const replacement = buildReplacement(stmt, sourceFile);
    changes.push(
      {
        type: ChangeType.Delete,
        start: stmt.getStart(sourceFile),
        length: stmt.getEnd() - stmt.getStart(sourceFile),
      },
      {
        type: ChangeType.Insert,
        index: stmt.getStart(sourceFile),
        text: replacement,
      }
    );
  }

  let updated =
    changes.length > 0 ? applyChangesToString(source, changes) : source;

  // Fallback: any remaining `@nx/devkit/src/...` specifiers (default imports,
  // namespace imports, side-effect imports, dynamic `import(...)`, `require(...)`
  // calls, etc.) get rewritten to `/internal`. We can't bucket by symbol for
  // those forms, so `/internal` is the safe default since it re-exports every
  // symbol that was deep-importable.
  updated = updated.replace(
    FALLBACK_RE,
    (_match, quote: string) => `${quote}${INTERNAL_SPECIFIER}${quote}`
  );

  // Final pass: collapse any duplicate `@nx/devkit` and `@nx/devkit/internal`
  // named-only imports into a single declaration. This handles both the
  // imports we just emitted AND any that the user already had, so we never
  // leave the file with two `from '@nx/devkit'` lines.
  updated = collapseDevkitImports(updated);

  return updated;
}

function collapseDevkitImports(source: string): string {
  const sourceFile = ts!.createSourceFile(
    'tmp.ts',
    source,
    ts!.ScriptTarget.Latest,
    /* setParentNodes */ true,
    ts!.ScriptKind.TSX
  );

  // Group eligible declarations by (specifier, isTypeOnly).
  type Group = {
    decls: ImportDeclaration[];
    specifier: string;
    typeOnly: boolean;
  };
  const groups = new Map<string, Group>();

  for (const stmt of sourceFile.statements) {
    if (!ts!.isImportDeclaration(stmt)) continue;
    if (!ts!.isStringLiteral(stmt.moduleSpecifier)) continue;
    const specifier = stmt.moduleSpecifier.text;
    if (specifier !== PUBLIC_SPECIFIER && specifier !== INTERNAL_SPECIFIER) {
      continue;
    }
    const importClause = stmt.importClause;
    if (!importClause) continue; // skip side-effect imports
    if (importClause.name) continue; // skip default imports
    const namedBindings = importClause.namedBindings;
    if (!namedBindings || !ts!.isNamedImports(namedBindings)) continue;

    const typeOnly = !!importClause.isTypeOnly;
    const key = `${specifier}\x00${typeOnly ? 'type' : 'value'}`;
    if (!groups.has(key)) {
      groups.set(key, { decls: [], specifier, typeOnly });
    }
    groups.get(key)!.decls.push(stmt);
  }

  const changes: StringChange[] = [];
  for (const { decls, specifier, typeOnly } of groups.values()) {
    if (decls.length < 2) continue;

    const seen = new Set<string>();
    const merged: string[] = [];
    for (const decl of decls) {
      const named = decl.importClause!.namedBindings as NamedImports;
      for (const el of named.elements) {
        const text = renderSpecifierFromNode(el, typeOnly);
        if (!seen.has(text)) {
          seen.add(text);
          merged.push(text);
        }
      }
    }

    // Replace the first declaration with the merged one in place.
    const first = decls[0];
    changes.push(
      {
        type: ChangeType.Delete,
        start: first.getStart(sourceFile),
        length: first.getEnd() - first.getStart(sourceFile),
      },
      {
        type: ChangeType.Insert,
        index: first.getStart(sourceFile),
        text: renderImport(merged, specifier, typeOnly),
      }
    );

    // Delete every other declaration in this group (and consume one trailing
    // newline so we don't leave behind a blank line that prettier has to clean
    // up later).
    for (let i = 1; i < decls.length; i++) {
      const decl = decls[i];
      const start = decl.getStart(sourceFile);
      let end = decl.getEnd();
      if (source[end] === '\n') {
        end += 1;
      } else if (source[end] === '\r' && source[end + 1] === '\n') {
        end += 2;
      }
      changes.push({
        type: ChangeType.Delete,
        start,
        length: end - start,
      });
    }
  }

  return changes.length > 0 ? applyChangesToString(source, changes) : source;
}

function renderSpecifierFromNode(
  el: ImportSpecifier,
  parentIsTypeOnly: boolean
): string {
  const aliasText = el.propertyName ? ` as ${el.name.text}` : '';
  const typePrefix = !parentIsTypeOnly && el.isTypeOnly ? 'type ' : '';
  return `${typePrefix}${(el.propertyName ?? el.name).text}${aliasText}`;
}

function buildReplacement(
  decl: ImportDeclaration,
  sourceFile: SourceFile
): string {
  const importClause = decl.importClause;

  // `import '@nx/devkit/src/...';` (side-effect) — no clause to bucket.
  if (!importClause) {
    return `import '${INTERNAL_SPECIFIER}';`;
  }

  const namedBindings = importClause.namedBindings;
  const isNamedImport =
    namedBindings && ts!.isNamedImports(namedBindings) && !importClause.name;

  // Default / namespace / mixed-default-and-named — can't bucket reliably.
  // Preserve the import shape, swap the specifier.
  if (!isNamedImport) {
    const before = source(decl, sourceFile).slice(
      0,
      decl.moduleSpecifier.getStart(sourceFile) - decl.getStart(sourceFile)
    );
    const after = source(decl, sourceFile).slice(
      decl.moduleSpecifier.getEnd() - decl.getStart(sourceFile)
    );
    return `${before}'${INTERNAL_SPECIFIER}'${after}`;
  }

  const isTypeOnlyImport = importClause.isTypeOnly;
  const elements = (namedBindings as NamedImports).elements;

  const publik: string[] = [];
  const internal: string[] = [];
  for (const el of elements) {
    bucketSpecifier(el, isTypeOnlyImport, publik, internal);
  }

  const lines: string[] = [];
  if (publik.length > 0) {
    lines.push(renderImport(publik, PUBLIC_SPECIFIER, isTypeOnlyImport));
  }
  if (internal.length > 0) {
    lines.push(renderImport(internal, INTERNAL_SPECIFIER, isTypeOnlyImport));
  }
  if (lines.length === 0) {
    // Defensive: empty `import {} from '...'` — point at /internal.
    lines.push(`import {} from '${INTERNAL_SPECIFIER}';`);
  }
  return lines.join('\n');
}

function bucketSpecifier(
  el: ImportSpecifier,
  parentIsTypeOnly: boolean,
  publik: string[],
  internal: string[]
): void {
  const lookupName = (el.propertyName ?? el.name).text;
  const elementIsTypeOnly = el.isTypeOnly;
  const aliasText = el.propertyName ? ` as ${el.name.text}` : '';
  // Inline `type` is illegal when the parent import is already `import type`.
  const typePrefix = !parentIsTypeOnly && elementIsTypeOnly ? 'type ' : '';
  const text = `${typePrefix}${(el.propertyName ?? el.name).text}${aliasText}`;

  if (DEVKIT_INTERNAL_SYMBOLS.has(lookupName)) {
    internal.push(text);
  } else {
    publik.push(text);
  }
}

function renderImport(
  specifiers: string[],
  from: string,
  typeOnly: boolean
): string {
  const prefix = typeOnly ? 'import type' : 'import';
  return `${prefix} { ${specifiers.join(', ')} } from '${from}';`;
}

function source(decl: ImportDeclaration, sourceFile: SourceFile): string {
  return sourceFile.text.slice(decl.getStart(sourceFile), decl.getEnd());
}
