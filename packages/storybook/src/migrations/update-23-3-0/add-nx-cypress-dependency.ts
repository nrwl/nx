import {
  addDependenciesToPackageJson,
  ensurePackage,
  formatFiles,
  getProjects,
  type MigrationReturnObject,
  readJson,
  readNxJson,
  type Tree,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import type { CallExpression, Node } from 'typescript';
import { nxVersion } from '../../utils/versions';

const NX_CYPRESS = '@nx/cypress';
const STORYBOOK_CYPRESS_PRESET = '@nx/storybook/presets/cypress';
const SOURCE_EXTENSIONS = [
  '.ts',
  '.tsx',
  '.cts',
  '.mts',
  '.js',
  '.jsx',
  '.cjs',
  '.mjs',
] as const;

let ts: typeof import('typescript') | undefined;

export default async function addNxCypressDependency(
  tree: Tree
): Promise<void | MigrationReturnObject> {
  if (!tree.exists('package.json') || isNxCypressDeclared(tree)) {
    return;
  }

  if (!usesNxCypressInConfig(tree)) {
    const { found, unparseableFiles } = findNxCypressInSource(tree);
    if (!found) {
      return unparseableFiles.length
        ? reportUnparseableFiles(unparseableFiles)
        : undefined;
    }
  }

  addDependenciesToPackageJson(
    tree,
    {},
    { [NX_CYPRESS]: nxVersion },
    undefined,
    true
  );

  await formatFiles(tree);
}

function isNxCypressDeclared(tree: Tree): boolean {
  const { dependencies, devDependencies } = readJson(tree, 'package.json');
  return !!(dependencies?.[NX_CYPRESS] || devDependencies?.[NX_CYPRESS]);
}

function isNxCypressModule(specifier: unknown): boolean {
  return (
    typeof specifier === 'string' &&
    (specifier === NX_CYPRESS ||
      specifier.startsWith(`${NX_CYPRESS}/`) ||
      specifier === STORYBOOK_CYPRESS_PRESET)
  );
}

function isNxCypressExecutor(executor: string | undefined): boolean {
  return executor?.startsWith(`${NX_CYPRESS}:`) ?? false;
}

function usesNxCypressInConfig(tree: Tree): boolean {
  for (const [, project] of getProjects(tree)) {
    for (const target of Object.values(project.targets ?? {})) {
      if (isNxCypressExecutor(target.executor)) {
        return true;
      }
    }
  }

  const nxJson = readNxJson(tree);

  // targetDefaults are keyed by target name or executor, and a default can set
  // the executor that an empty project target inherits.
  for (const [targetOrExecutor, config] of Object.entries(
    nxJson?.targetDefaults ?? {}
  )) {
    if (isNxCypressExecutor(targetOrExecutor)) {
      return true;
    }
    for (const entry of Array.isArray(config) ? config : [config]) {
      if (isNxCypressExecutor(entry?.executor)) {
        return true;
      }
    }
  }

  return (
    nxJson?.plugins?.some((plugin) =>
      isNxCypressModule(typeof plugin === 'string' ? plugin : plugin?.plugin)
    ) ?? false
  );
}

function findNxCypressInSource(tree: Tree): {
  found: boolean;
  unparseableFiles: string[];
} {
  let found = false;
  const unparseableFiles: string[] = [];
  visitNotIgnoredFiles(tree, '.', (filePath) => {
    if (
      found ||
      !SOURCE_EXTENSIONS.some((extension) => filePath.endsWith(extension))
    ) {
      return;
    }
    const content = tree.read(filePath, 'utf-8');
    if (
      !content?.includes(NX_CYPRESS) &&
      !content?.includes(STORYBOOK_CYPRESS_PRESET)
    ) {
      return;
    }
    const reference = findNxCypressReference(filePath, content);
    if (reference === 'found') {
      found = true;
    } else if (reference === 'unparseable') {
      unparseableFiles.push(filePath);
    }
  });
  return { found, unparseableFiles };
}

function findNxCypressReference(
  filePath: string,
  content: string
): 'found' | 'unparseable' | 'none' {
  ts ??= ensurePackage<typeof import('typescript')>('typescript', '*');
  const sourceFile = ts.createSourceFile(
    filePath,
    content,
    ts.ScriptTarget.Latest
  );

  const visit = (node: Node): boolean =>
    isNxCypressModuleReference(node) || !!ts!.forEachChild(node, visit);
  if (ts.forEachChild(sourceFile, visit)) {
    return 'found';
  }

  // Error recovery can drop a module reference from the AST, so a file with
  // syntax errors does not prove the reference is absent.
  return (sourceFile as { parseDiagnostics?: unknown[] }).parseDiagnostics
    ?.length
    ? 'unparseable'
    : 'none';
}

function reportUnparseableFiles(files: string[]): MigrationReturnObject {
  const fileList = files.join(', ');
  return {
    nextSteps: [
      `Could not parse ${fileList}. If any of them loads \`${NX_CYPRESS}\` or \`${STORYBOOK_CYPRESS_PRESET}\`, add \`${NX_CYPRESS}\` to the root package.json devDependencies.`,
    ],
    agentContext: [
      `These files have syntax errors, so the migration could not tell whether they load ${NX_CYPRESS} or ${STORYBOOK_CYPRESS_PRESET}: ${fileList}. If one does, add "${NX_CYPRESS}": "${nxVersion}" to the root package.json devDependencies.`,
    ],
  };
}

function isNxCypressModuleReference(node: Node): boolean {
  const tsModule = ts!;
  let specifier: Node | undefined;

  if (
    tsModule.isImportDeclaration(node) ||
    tsModule.isExportDeclaration(node)
  ) {
    specifier = node.moduleSpecifier;
  } else if (
    tsModule.isImportEqualsDeclaration(node) &&
    tsModule.isExternalModuleReference(node.moduleReference)
  ) {
    specifier = node.moduleReference.expression;
  } else if (
    tsModule.isImportTypeNode(node) &&
    tsModule.isLiteralTypeNode(node.argument)
  ) {
    specifier = node.argument.literal;
  } else if (tsModule.isCallExpression(node) && isModuleLoadCall(node)) {
    specifier = node.arguments[0];
  }

  return (
    !!specifier &&
    (tsModule.isStringLiteral(specifier) ||
      tsModule.isNoSubstitutionTemplateLiteral(specifier)) &&
    isNxCypressModule(specifier.text)
  );
}

function isModuleLoadCall(node: CallExpression): boolean {
  const tsModule = ts!;
  const callee = node.expression;
  return (
    callee.kind === tsModule.SyntaxKind.ImportKeyword ||
    (tsModule.isIdentifier(callee) && callee.text === 'require') ||
    (tsModule.isPropertyAccessExpression(callee) &&
      tsModule.isIdentifier(callee.expression) &&
      callee.expression.text === 'require' &&
      callee.name.text === 'resolve')
  );
}
