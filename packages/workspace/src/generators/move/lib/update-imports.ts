import {
  ChangeType,
  ProjectConfiguration,
  StringChange,
  Tree,
  applyChangesToString,
  getProjects,
  getWorkspaceLayout,
  joinPathFragments,
  readJson,
  visitNotIgnoredFiles,
  writeJson,
} from '@nx/devkit';
import { isAbsolute, normalize, relative } from 'path';
import type * as ts from 'typescript';
import { getImportPath } from '../../../utilities/get-import-path';
import {
  findNodes,
  getRootTsConfigPathInTree,
} from '../../../utilities/ts-config';
import { ensureTypescript } from '../../../utilities/typescript';
import { NormalizedSchema } from '../schema';
import { normalizePathSlashes } from './utils';
import { isUsingTsSolutionSetup } from '../../../utilities/typescript/ts-solution-setup';
import { getProjectSourceRoot } from '../../utils/project-config';

let tsModule: typeof import('typescript');

/**
 * Updates all the imports in the workspace and modifies the tsconfig appropriately.
 *
 * @param schema The options provided to the schematic
 */
export function updateImports(
  tree: Tree,
  schema: NormalizedSchema,
  project: ProjectConfiguration
) {
  if (project.projectType !== 'library') {
    return;
  }

  const { libsDir } = getWorkspaceLayout(tree);
  const projects = getProjects(tree);

  const isUsingTsSolution = isUsingTsSolutionSetup(tree);

  // use the source root to find the from location
  // this attempts to account for libs that have been created with --importPath
  const tsConfigPath = isUsingTsSolution
    ? 'tsconfig.json'
    : getRootTsConfigPathInTree(tree);
  // If we are using a ts solution setup, we need to use tsconfig.json instead of tsconfig.base.json
  let tsConfig: any;
  let mainEntryPointImportPath: string;
  let secondaryEntryPointImportPaths: string[];
  let serverEntryPointImportPath: string;
  if (tree.exists(tsConfigPath)) {
    tsConfig = readJson(tree, tsConfigPath);
    const sourceRoot = getProjectSourceRoot(project, tree);

    mainEntryPointImportPath = Object.keys(
      tsConfig.compilerOptions?.paths ?? {}
    ).find((path) =>
      tsConfig.compilerOptions.paths[path].some((x) =>
        x.startsWith(ensureTrailingSlash(sourceRoot))
      )
    );
    secondaryEntryPointImportPaths = Object.keys(
      tsConfig.compilerOptions?.paths ?? {}
    ).filter((path) =>
      tsConfig.compilerOptions.paths[path].some(
        (x) =>
          x.startsWith(ensureTrailingSlash(project.root)) &&
          !x.startsWith(ensureTrailingSlash(sourceRoot))
      )
    );

    // Next.js libs have a custom path for the server we need to update that as well
    // example "paths": { @acme/lib/server : ['libs/lib/src/server.ts'] }
    serverEntryPointImportPath = Object.keys(
      tsConfig.compilerOptions?.paths ?? {}
    ).find((path) =>
      tsConfig.compilerOptions.paths[path].some(
        (x) =>
          x.startsWith(ensureTrailingSlash(sourceRoot)) &&
          x.includes('server') &&
          path.endsWith('server')
      )
    );
  }

  mainEntryPointImportPath ??= normalizePathSlashes(
    getImportPath(
      tree,
      project.root.slice(libsDir.length).replace(/^\/|\\/, '')
    )
  );

  const projectRefs = [
    {
      from: mainEntryPointImportPath,
      to: schema.importPath,
    },
    ...(secondaryEntryPointImportPaths
      ? secondaryEntryPointImportPaths.map((p) => ({
          from: p,
          // if the import path doesn't start with the main entry point import path,
          // it's a custom import path we don't know how to update the name, we keep
          // it as-is, but we'll update the path it points to
          to:
            schema.importPath && p.startsWith(mainEntryPointImportPath)
              ? p.replace(mainEntryPointImportPath, schema.importPath)
              : null,
        }))
      : []),
  ];

  if (
    serverEntryPointImportPath &&
    schema.importPath &&
    serverEntryPointImportPath.startsWith(mainEntryPointImportPath)
  ) {
    projectRefs.push({
      from: serverEntryPointImportPath,
      to: serverEntryPointImportPath.replace(
        mainEntryPointImportPath,
        schema.importPath
      ),
    });
  }

  for (const projectRef of projectRefs) {
    if (schema.updateImportPath && projectRef.to) {
      const replaceProjectRef = new RegExp(projectRef.from, 'g');

      for (const [name, definition] of Array.from(projects.entries())) {
        if (name === schema.projectName) {
          continue;
        }

        visitNotIgnoredFiles(tree, definition.root, (file) => {
          const contents = tree.read(file, 'utf-8');
          replaceProjectRef.lastIndex = 0;
          if (!replaceProjectRef.test(contents)) {
            return;
          }

          updateImportPaths(tree, file, projectRef.from, projectRef.to);
        });
      }
    }

    const projectRoot = {
      from: project.root,
      to: schema.relativeToRootDestination,
    };

    if (tsConfig) {
      if (!isUsingTsSolution) {
        updateTsConfigPaths(
          tsConfig,
          projectRef,
          tsConfigPath,
          projectRoot,
          schema
        );
      } else {
        updateTsConfigReferences(tsConfig, projectRoot, tsConfigPath, schema);
      }
      writeJson(tree, tsConfigPath, tsConfig);
    }
  }
}

function updateTsConfigReferences(
  tsConfig: any,
  projectRoot: { from: string; to: string },
  tsConfigPath: string,
  schema: NormalizedSchema
) {
  // Since paths can be './path' or 'path' we check if both are the same relative path to the workspace root
  const projectRefIndex = tsConfig.references.findIndex(
    (ref) => relative(ref.path, projectRoot.from) === ''
  );
  if (projectRefIndex === -1) {
    throw new Error(
      `unable to find "${projectRoot.from}" in ${tsConfigPath} references`
    );
  }
  const updatedPath = joinPathFragments(
    projectRoot.to,
    relative(projectRoot.from, tsConfig.references[projectRefIndex].path)
  );

  let normalizedPath = normalize(updatedPath);
  if (
    !normalizedPath.startsWith('.') &&
    !normalizedPath.startsWith('../') &&
    !isAbsolute(normalizedPath)
  ) {
    normalizedPath = `./${normalizedPath}`;
  }

  if (schema.updateImportPath && projectRoot.to) {
    tsConfig.references[projectRefIndex].path = normalizedPath;
  } else {
    tsConfig.references.push({ path: normalizedPath });
  }
}

function updateTsConfigPaths(
  tsConfig: any,
  projectRef: { from: string; to: string },
  tsConfigPath: string,
  projectRoot: { from: string; to: string },
  schema: NormalizedSchema
) {
  const path = tsConfig.compilerOptions.paths[projectRef.from] as string[];
  if (!path) {
    throw new Error(
      [
        `unable to find "${projectRef.from}" in`,
        `${tsConfigPath} compilerOptions.paths`,
      ].join(' ')
    );
  }
  const updatedPath = path.map((x) =>
    joinPathFragments(projectRoot.to, relative(projectRoot.from, x))
  );

  if (schema.updateImportPath && projectRef.to) {
    tsConfig.compilerOptions.paths[projectRef.to] = updatedPath;
    if (projectRef.from !== projectRef.to) {
      delete tsConfig.compilerOptions.paths[projectRef.from];
    }
  } else {
    tsConfig.compilerOptions.paths[projectRef.from] = updatedPath;
  }
}

function ensureTrailingSlash(path: string): string {
  return path.endsWith('/') ? path : `${path}/`;
}

/**
 * Changes imports in a file from one import to another
 */
function updateImportPaths(tree: Tree, path: string, from: string, to: string) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const contents = tree.read(path, 'utf-8');
  const sourceFile = tsModule.createSourceFile(
    path,
    contents,
    tsModule.ScriptTarget.Latest,
    true
  );

  // Apply changes on the various types of imports
  const newContents = applyChangesToString(contents, [
    ...updateImportDeclarations(sourceFile, from, to),
    ...updateDynamicImports(sourceFile, from, to),
  ]);

  tree.write(path, newContents);
}

/**
 * Update the module specifiers on static imports
 */
function updateImportDeclarations(
  sourceFile: ts.SourceFile,
  from: string,
  to: string
): StringChange[] {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const importDecls = findNodes(sourceFile, [
    tsModule.SyntaxKind.ImportDeclaration,
    tsModule.SyntaxKind.ExportDeclaration,
  ]) as ts.ImportDeclaration[];

  const changes: StringChange[] = [];

  for (const { moduleSpecifier } of importDecls) {
    if (moduleSpecifier && tsModule.isStringLiteral(moduleSpecifier)) {
      changes.push(...updateModuleSpecifier(moduleSpecifier, from, to));
    }
  }

  return changes;
}

/**
 * Update the module specifiers on dynamic imports and require statements
 */
function updateDynamicImports(
  sourceFile: ts.SourceFile,
  from: string,
  to: string
): StringChange[] {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }
  const expressions = findNodes(
    sourceFile,
    tsModule.SyntaxKind.CallExpression
  ) as ts.CallExpression[];

  const changes: StringChange[] = [];

  for (const { expression, arguments: args } of expressions) {
    const moduleSpecifier = args[0];

    // handle dynamic import statements
    if (
      expression.kind === tsModule.SyntaxKind.ImportKeyword &&
      moduleSpecifier &&
      tsModule.isStringLiteral(moduleSpecifier)
    ) {
      changes.push(...updateModuleSpecifier(moduleSpecifier, from, to));
    }

    // handle require statements
    if (
      tsModule.isIdentifier(expression) &&
      expression.text === 'require' &&
      moduleSpecifier &&
      tsModule.isStringLiteral(moduleSpecifier)
    ) {
      changes.push(...updateModuleSpecifier(moduleSpecifier, from, to));
    }
  }

  return changes;
}

/**
 * Replace the old module specifier with a the new path
 */
function updateModuleSpecifier(
  moduleSpecifier: ts.StringLiteral,
  from: string,
  to: string
): StringChange[] {
  if (
    moduleSpecifier.text === from ||
    moduleSpecifier.text.startsWith(`${from}/`)
  ) {
    return [
      {
        type: ChangeType.Delete,
        start: moduleSpecifier.getStart() + 1,
        length: moduleSpecifier.text.length,
      },
      {
        type: ChangeType.Insert,
        index: moduleSpecifier.getStart() + 1,
        text: moduleSpecifier.text.replace(new RegExp(from, 'g'), to),
      },
    ];
  } else {
    return [];
  }
}
