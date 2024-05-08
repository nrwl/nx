import type { Node, SyntaxKind } from 'typescript';
import { visitNotIgnoredFiles } from '../../generators/visit-not-ignored-files';
import { formatFiles } from '../../generators/format-files';
import {
  addDependenciesToPackageJson,
  ensurePackage,
} from '../../utils/package-json';
import { typescriptVersion } from '../../utils/versions';

import { GeneratorCallback, readJson, Tree } from 'nx/src/devkit-exports';

let tsModule: typeof import('typescript');

const MODULE_FEDERATION_PUBLIC_TOKENS = [
  'AdditionalSharedConfig',
  'ModuleFederationConfig',
  'SharedLibraryConfig',
  'SharedWorkspaceLibraryConfig',
  'WorkspaceLibrary',
  'SharedFunction',
  'WorkspaceLibrarySecondaryEntryPoint',
  'Remotes',
  'ModuleFederationLibrary',
  'applySharedFunction',
  'applyAdditionalShared',
  'getNpmPackageSharedConfig',
  'shareWorkspaceLibraries',
  'sharePackages',
  'mapRemotes',
  'mapRemotesForSSR',
  'getDependentPackagesForProject',
  'readRootPackageJson',
];

export default async (tree: Tree): Promise<GeneratorCallback | void> => {
  let hasFileToMigrate = false;
  visitNotIgnoredFiles(tree, '/', (path) => {
    if (!path.endsWith('.ts') && !path.endsWith('.js')) {
      return;
    }

    let fileContents = tree.read(path, 'utf-8');
    if (
      MODULE_FEDERATION_PUBLIC_TOKENS.every(
        (token) => !fileContents.includes(token)
      )
    ) {
      return;
    }

    hasFileToMigrate = true;

    fileContents = replaceTSImports(tree, path, fileContents);
    fileContents = replaceRequireCalls(tree, path, fileContents);
    fileContents = replaceJSDoc(tree, path, fileContents);
    tree.write(path, fileContents);
  });

  if (hasFileToMigrate) {
    await formatFiles(tree);

    const pkgJson = readJson(tree, 'package.json');
    const nxVersion =
      pkgJson.devDependencies?.['nx'] ??
      pkgJson.dependencies?.['nx'] ??
      '17.0.0';
    return addDependenciesToPackageJson(tree, {}, { '@nx/webpack': nxVersion });
  }
};

function replaceJSDoc(tree: Tree, path: string, fileContents: string) {
  let newFileContents = fileContents;
  for (const token of MODULE_FEDERATION_PUBLIC_TOKENS) {
    newFileContents = newFileContents.replaceAll(
      new RegExp(
        `(@type)+\\s({)+(\\s)*(import\\(('|")+@nx\/devkit('|")+\\)\.)+(${token})+\\s*(})+`,
        'g'
      ),
      `@type {import('@nx/webpack').${token}}`
    );
  }

  return newFileContents;
}

function replaceRequireCalls(
  tree: Tree,
  path: string,
  fileContents: string
): string {
  if (!tsModule) {
    tsModule = ensurePackage('typescript', typescriptVersion);
  }

  const sourceFile = tsModule.createSourceFile(
    path,
    fileContents,
    tsModule.ScriptTarget.Latest,
    true
  );

  const allDevkitRequires = findNodes(
    sourceFile,
    tsModule.SyntaxKind.VariableStatement
  )
    .filter((node) =>
      [`require("@nx/devkit")`, `require('@nx/devkit')`].some((r) =>
        node.getText().includes(r)
      )
    )
    .filter(
      (node) => findNodes(node, tsModule.SyntaxKind.ObjectBindingPattern).length
    );

  const mfUtilRequires = allDevkitRequires.filter((node) =>
    MODULE_FEDERATION_PUBLIC_TOKENS.some((token) =>
      node.getText().includes(token)
    )
  );

  if (!mfUtilRequires.length) {
    return fileContents;
  }

  const mfUtilTokens = mfUtilRequires.map((node) => {
    const allTokens = findNodes(node, tsModule.SyntaxKind.BindingElement);
    const mfTokens = allTokens.filter((node) =>
      MODULE_FEDERATION_PUBLIC_TOKENS.some((token) => node.getText() === token)
    );

    return {
      requireNode: node,
      onlyMf: allTokens.length === mfTokens.length,
      mfTokens,
    };
  });

  const changes: {
    startPosition: number;
    endPosition?: number;
    content: string;
  }[] = [];
  for (const mfUtilRequireData of mfUtilTokens) {
    if (mfUtilRequireData.onlyMf) {
      changes.push({
        startPosition: mfUtilRequireData.requireNode.getStart(),
        endPosition: mfUtilRequireData.requireNode.getEnd(),
        content: '',
      });
    } else {
      for (const mfToken of mfUtilRequireData.mfTokens) {
        const replaceTrailingComma =
          mfToken.getText().charAt(mfToken.getEnd() + 1) === ',';
        changes.push({
          startPosition: mfToken.getStart(),
          endPosition: replaceTrailingComma
            ? mfToken.getEnd() + 1
            : mfToken.getEnd(),
          content: '',
        });
      }
    }
  }

  changes.push({
    startPosition: mfUtilTokens[mfUtilTokens.length - 1].requireNode.getEnd(),
    content: `\nconst { ${mfUtilTokens
      .map((mfUtilToken) => mfUtilToken.mfTokens.map((node) => node.getText()))
      .join(', ')} } = require('@nx/webpack');`,
  });

  let newFileContents = fileContents;
  while (changes.length) {
    const change = changes.pop();
    newFileContents = `${newFileContents.substring(0, change.startPosition)}${
      change.content
    }${newFileContents.substring(
      change.endPosition ? change.endPosition : change.startPosition
    )}`;
  }

  return newFileContents;
}

function replaceTSImports(
  tree: Tree,
  path: string,
  fileContents: string
): string {
  if (!tsModule) {
    tsModule = ensurePackage('typescript', typescriptVersion);
  }

  const sourceFile = tsModule.createSourceFile(
    path,
    fileContents,
    tsModule.ScriptTarget.Latest,
    true
  );

  const allImports = findNodes(
    sourceFile,
    tsModule.SyntaxKind.ImportDeclaration
  );
  const devkitImports = allImports.filter((i) =>
    i.getText().includes(`'@nx/devkit';`)
  );
  const mfUtilsImports = devkitImports.filter((i) =>
    MODULE_FEDERATION_PUBLIC_TOKENS.some((token) => i.getText().includes(token))
  );

  if (!mfUtilsImports.length) {
    return fileContents;
  }

  const mfUtilsWithMultipleImports = mfUtilsImports.map((i) => {
    const importSpecifierNodes = findNodes(
      i,
      tsModule.SyntaxKind.ImportSpecifier
    );
    const mfImportSpecifierNodes = importSpecifierNodes.filter((node) =>
      MODULE_FEDERATION_PUBLIC_TOKENS.some((token) =>
        node.getText().includes(token)
      )
    );

    return {
      importDeclarationNode: i,
      onlyMf: mfImportSpecifierNodes.length === importSpecifierNodes.length,
      mfImportSpecifierNodes,
    };
  });

  const changes: {
    startPosition: number;
    endPosition?: number;
    content: string;
  }[] = [];
  for (const importDeclaration of mfUtilsWithMultipleImports) {
    if (importDeclaration.onlyMf) {
      changes.push({
        startPosition: importDeclaration.importDeclarationNode.getStart(),
        endPosition: importDeclaration.importDeclarationNode.getEnd(),
        content: '',
      });
    } else {
      for (const mfImportSpecifierNodes of importDeclaration.mfImportSpecifierNodes) {
        const replaceTrailingComma =
          importDeclaration.importDeclarationNode
            .getText()
            .charAt(mfImportSpecifierNodes.getEnd() + 1) === ',';
        changes.push({
          startPosition: mfImportSpecifierNodes.getStart(),
          endPosition: replaceTrailingComma
            ? mfImportSpecifierNodes.getEnd() + 1
            : mfImportSpecifierNodes.getEnd(),
          content: '',
        });
      }
    }
  }

  changes.push({
    startPosition:
      mfUtilsWithMultipleImports[
        mfUtilsWithMultipleImports.length - 1
      ].importDeclarationNode.getEnd(),
    content: `\nimport { ${mfUtilsWithMultipleImports
      .map((importDeclaration) =>
        importDeclaration.mfImportSpecifierNodes.map((node) => node.getText())
      )
      .join(', ')} } from '@nx/webpack';`,
  });

  let newFileContents = fileContents;
  while (changes.length) {
    const change = changes.pop();
    newFileContents = `${newFileContents.substring(0, change.startPosition)}${
      change.content
    }${newFileContents.substring(
      change.endPosition ? change.endPosition : change.startPosition
    )}`;
  }

  return newFileContents;
}

function findNodes(
  node: Node,
  kind: SyntaxKind | SyntaxKind[],
  max = Infinity
): Node[] {
  if (!node || max == 0) {
    return [];
  }

  const arr: Node[] = [];
  const hasMatch = Array.isArray(kind)
    ? kind.includes(node.kind)
    : node.kind === kind;
  if (hasMatch) {
    arr.push(node);
    max--;
  }
  if (max > 0) {
    for (const child of node.getChildren()) {
      findNodes(child, kind, max).forEach((node) => {
        if (max > 0) {
          arr.push(node);
        }
        max--;
      });

      if (max <= 0) {
        break;
      }
    }
  }

  return arr;
}
