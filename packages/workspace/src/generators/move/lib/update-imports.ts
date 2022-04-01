import {
  applyChangesToString,
  ChangeType,
  getProjects,
  getWorkspaceLayout,
  ProjectConfiguration,
  StringChange,
  Tree,
  visitNotIgnoredFiles,
  writeJson,
} from '@nrwl/devkit';
import * as ts from 'typescript';
import { getRootTsConfigPathInTree } from '../../../utilities/typescript';
import { findNodes } from '../../../utilities/typescript/find-nodes';
import { NormalizedSchema } from '../schema';
import { normalizeSlashes } from './utils';

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
  if (project.projectType === 'application') {
    // These shouldn't be imported anywhere?
    return;
  }

  const { npmScope, libsDir } = getWorkspaceLayout(tree);
  const projects = getProjects(tree);

  // use the source root to find the from location
  // this attempts to account for libs that have been created with --importPath
  const tsConfigPath = getRootTsConfigPathInTree(tree);
  let tsConfig: any;
  let fromPath: string;
  if (tree.exists(tsConfigPath)) {
    tsConfig = JSON.parse(tree.read(tsConfigPath).toString('utf-8'));
    fromPath = Object.keys(tsConfig.compilerOptions.paths).find((path) =>
      tsConfig.compilerOptions.paths[path].some((x) =>
        x.startsWith(project.sourceRoot)
      )
    );
  }

  const projectRef = {
    from:
      fromPath ||
      normalizeSlashes(
        `@${npmScope}/${project.root.slice(libsDir.length + 1)}`
      ),
    to: schema.importPath,
  };

  if (schema.updateImportPath) {
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
    from: project.root.slice(libsDir.length + 1),
    to: schema.destination,
  };

  if (tsConfig) {
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
      x.replace(new RegExp(projectRoot.from, 'g'), projectRoot.to)
    );

    if (schema.updateImportPath) {
      tsConfig.compilerOptions.paths[projectRef.to] = updatedPath;
      delete tsConfig.compilerOptions.paths[projectRef.from];
    } else {
      tsConfig.compilerOptions.paths[projectRef.from] = updatedPath;
    }

    writeJson(tree, tsConfigPath, tsConfig);
  }
}

/**
 * Changes imports in a file from one import to another
 */
function updateImportPaths(tree: Tree, path: string, from: string, to: string) {
  const contents = tree.read(path, 'utf-8');
  const sourceFile = ts.createSourceFile(
    path,
    contents,
    ts.ScriptTarget.Latest,
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
  const importDecls = findNodes(
    sourceFile,
    ts.SyntaxKind.ImportDeclaration
  ) as ts.ImportDeclaration[];

  const changes: StringChange[] = [];

  for (const { moduleSpecifier } of importDecls) {
    if (ts.isStringLiteral(moduleSpecifier)) {
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
  const expressions = findNodes(
    sourceFile,
    ts.SyntaxKind.CallExpression
  ) as ts.CallExpression[];

  const changes: StringChange[] = [];

  for (const { expression, arguments: args } of expressions) {
    const moduleSpecifier = args[0];

    // handle dynamic import statements
    if (
      expression.kind === ts.SyntaxKind.ImportKeyword &&
      moduleSpecifier &&
      ts.isStringLiteral(moduleSpecifier)
    ) {
      changes.push(...updateModuleSpecifier(moduleSpecifier, from, to));
    }

    // handle require statements
    if (
      ts.isIdentifier(expression) &&
      expression.text === 'require' &&
      moduleSpecifier &&
      ts.isStringLiteral(moduleSpecifier)
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
