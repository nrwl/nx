import type { Tree } from '@nx/devkit';
import {
  addDependenciesToPackageJson,
  createProjectGraphAsync,
  readCachedProjectGraph,
  readJson,
  readProjectConfiguration,
  visitNotIgnoredFiles,
} from '@nx/devkit';
import { extname } from 'path';
import { tsquery } from '@phenomnomnominal/tsquery';
import {
  jasmineMarblesVersion as latestJasmineMarblesVersion,
  rxjsVersion as latestRxjsVersion,
} from '../../utils/versions';
import { checkAndCleanWithSemver } from '@nx/devkit/src/utils/semver';
import { gte } from 'semver';

export default async function switchToJasmineMarbles(tree: Tree) {
  const usesJasmineMarbles = await replaceJasmineMarbleUsagesInFiles(tree);
  addJasmineMarblesDevDependencyIfUsed(tree, usesJasmineMarbles);
}

async function replaceJasmineMarbleUsagesInFiles(tree: Tree) {
  let usesJasmineMarbles = false;

  const projectGraph = await (() => {
    try {
      return readCachedProjectGraph();
    } catch {
      return createProjectGraphAsync();
    }
  })();

  const dirsToTraverse = Object.entries(projectGraph.dependencies)
    .filter(([node, dep]) =>
      dep.some(
        ({ target }) =>
          target === 'npm:@nrwl/angular' && !projectGraph.externalNodes?.[node]
      )
    )
    .map(([projectName]) => readProjectConfiguration(tree, projectName).root);

  for (const dir of dirsToTraverse) {
    visitNotIgnoredFiles(tree, dir, (path) => {
      if (extname(path) !== '.ts') {
        return;
      }

      const fileContents = tree.read(path, 'utf-8');
      if (!fileContents.includes('@nrwl/angular/testing')) {
        return;
      }

      const NRWL_ANGULAR_TESTING_IMPORT_SELECTOR =
        'ImportDeclaration:has(StringLiteral[value="@nrwl/angular/testing"])';
      const ast = tsquery.ast(fileContents);
      const nrwlAngularTestingImportNodes = tsquery(
        ast,
        NRWL_ANGULAR_TESTING_IMPORT_SELECTOR,
        { visitAllChildren: true }
      );

      if (
        !nrwlAngularTestingImportNodes ||
        nrwlAngularTestingImportNodes.length === 0
      ) {
        return;
      }

      const jasmineMarblesExportsRegex = new RegExp(
        /(hot|cold|getTestScheduler|time)/
      );
      if (
        !jasmineMarblesExportsRegex.test(
          nrwlAngularTestingImportNodes[0].getText()
        )
      ) {
        return;
      }

      const IMPORT_SPECIFIERS_SELECTOR = 'NamedImports > ImportSpecifier';
      const importSpecifierNodes = tsquery(
        nrwlAngularTestingImportNodes[0],
        IMPORT_SPECIFIERS_SELECTOR,
        { visitAllChildren: true }
      );

      if (!importSpecifierNodes || importSpecifierNodes.length === 0) {
        return;
      }

      const validNrwlTestingImports = [];
      const validJasmineMarbleImports = [];
      for (const node of importSpecifierNodes) {
        const importSymbol = node.getText();
        if (jasmineMarblesExportsRegex.test(importSymbol)) {
          validJasmineMarbleImports.push(importSymbol);
        } else {
          validNrwlTestingImports.push(importSymbol);
        }
      }

      if (!usesJasmineMarbles && validJasmineMarbleImports.length > 0) {
        usesJasmineMarbles = true;
      }

      const newFileContents = `${fileContents.slice(
        0,
        nrwlAngularTestingImportNodes[0].getStart()
      )}${
        validNrwlTestingImports.length > 0
          ? `import {${validNrwlTestingImports.join(
              ','
            )}} from '@nrwl/angular/testing';`
          : ''
      }
    ${
      validJasmineMarbleImports.length > 0
        ? `import {${validJasmineMarbleImports.join(
            ','
          )}} from 'jasmine-marbles';${fileContents.slice(
            nrwlAngularTestingImportNodes[0].getEnd(),
            -1
          )}`
        : ''
    }`;

      tree.write(path, newFileContents);
    });
  }
  return usesJasmineMarbles;
}

function addJasmineMarblesDevDependencyIfUsed(
  tree: Tree,
  usesJasmineMarbles: boolean
) {
  if (!usesJasmineMarbles) {
    return;
  }

  const pkgJson = readJson(tree, 'package.json');
  const jasmineMarblesDependency = pkgJson.dependencies['jasmine-marbles'];
  const jasmineMarblesDevDependency =
    pkgJson.devDependencies['jasmine-marbles'];

  if (jasmineMarblesDependency || jasmineMarblesDevDependency) {
    return;
  }

  const jasmineMarblesVersion = getJasmineMarblesVersion(tree);

  addDependenciesToPackageJson(
    tree,
    {},
    {
      'jasmine-marbles': jasmineMarblesVersion,
    }
  );
}

function getJasmineMarblesVersion(tree: Tree): string {
  let rxjsVersion: string;
  try {
    const { dependencies, devDependencies } = readJson(tree, 'package.json');
    rxjsVersion = checkAndCleanWithSemver(
      'rxjs',
      dependencies?.rxjs ?? devDependencies?.rxjs
    );
  } catch {
    rxjsVersion = checkAndCleanWithSemver('rxjs', latestRxjsVersion);
  }

  return gte(rxjsVersion, '7.0.0') ? latestJasmineMarblesVersion : '~0.8.3';
}
