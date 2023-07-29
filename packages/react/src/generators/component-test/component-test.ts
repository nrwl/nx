import {
  ensurePackage,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
  Tree,
} from '@nx/devkit';
import { basename, dirname, extname, relative } from 'path';
import {
  findExportDeclarationsForJsx,
  getComponentNode,
} from '../../utils/ast-utils';
import { getDefaultsForComponent } from '../../utils/component-props';
import { nxVersion } from '../../utils/versions';
import { ComponentTestSchema } from './schema';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';

let tsModule: typeof import('typescript');

export async function componentTestGenerator(
  tree: Tree,
  options: ComponentTestSchema
) {
  ensurePackage('@nx/cypress', nxVersion);
  const { assertMinimumCypressVersion } = await import(
    '@nx/cypress/src/utils/cypress-version'
  );
  assertMinimumCypressVersion(10);
  // normalize any windows paths
  options.componentPath = options.componentPath.replace(/\\/g, '/');

  const projectConfig = readProjectConfiguration(tree, options.project);

  const normalizedPath = options.componentPath.startsWith(
    projectConfig.sourceRoot
  )
    ? relative(projectConfig.sourceRoot, options.componentPath)
    : options.componentPath;

  const componentPath = joinPathFragments(
    projectConfig.sourceRoot,
    normalizedPath
  );

  if (tree.exists(componentPath)) {
    generateSpecsForComponents(tree, componentPath);
  }
}

function generateSpecsForComponents(tree: Tree, filePath: string) {
  if (!tsModule) {
    tsModule = ensureTypescript();
  }

  const sourceFile = tsModule.createSourceFile(
    filePath,
    tree.read(filePath, 'utf-8'),
    tsModule.ScriptTarget.Latest,
    true
  );

  const cmpNodes = findExportDeclarationsForJsx(sourceFile);
  const componentDir = dirname(filePath);
  const ext = extname(filePath);
  const fileName = basename(filePath, ext);

  if (tree.exists(joinPathFragments(componentDir, `${fileName}.cy${ext}`))) {
    return;
  }

  const defaultExport = getComponentNode(sourceFile);

  if (cmpNodes?.length) {
    const components = cmpNodes.map((cmp) => {
      const defaults = getDefaultsForComponent(sourceFile, cmp);
      const isDefaultExport = defaultExport
        ? (defaultExport as any).name.text === (cmp as any).name.text
        : false;
      return {
        isDefaultExport,
        props: [...defaults.props, ...defaults.argTypes],
        name: (cmp as any).name.text as string,
        typeName: defaults.propsTypeName,
      };
    });
    const namedImports = components
      .reduce((imports, cmp) => {
        if (cmp.typeName) {
          imports.push(cmp.typeName);
        }
        if (cmp.isDefaultExport) {
          return imports;
        }

        imports.push(cmp.name);
        return imports;
      }, [])
      .join(', ');

    const namedImportStatement =
      namedImports.length > 0 ? `, { ${namedImports} }` : '';

    generateFiles(tree, joinPathFragments(__dirname, 'files'), componentDir, {
      fileName,
      components,
      importStatement: defaultExport
        ? `import ${
            (defaultExport as any).name.text
          }${namedImportStatement} from './${fileName}'`
        : `import { ${namedImports} } from './${fileName}'`,
      ext,
    });
  }
}

export default componentTestGenerator;
