import { joinPathFragments, type Tree } from '@nx/devkit';
import { parse } from 'path';
import type { Node, SourceFile } from 'typescript';
import { getInstalledAngularVersionInfo } from '../../utils/version-utils';

export function convertScamToStandalone(
  componentAST: SourceFile,
  componentFileContents: string,
  importsArray: string[],
  providersArray: string[],
  moduleNodes: Array<Node>,
  tree: Tree,
  normalizedComponentPath: string,
  componentName: string
) {
  let newComponentContents = '';
  const COMPONENT_PROPERTY_SELECTOR =
    'ClassDeclaration > Decorator > CallExpression:has(Identifier[name=Component]) ObjectLiteralExpression';
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const componentDecoratorMetadataNode = tsquery(
    componentAST,
    COMPONENT_PROPERTY_SELECTOR,
    { visitAllChildren: true }
  )[0];

  const { major: angularMajorVersion } = getInstalledAngularVersionInfo(tree);

  newComponentContents = `${componentFileContents.slice(
    0,
    componentDecoratorMetadataNode.getStart() - 1
  )}({${angularMajorVersion < 19 ? `\nstandalone: true,` : ''}
    imports: [${importsArray.join(',')}],${
    providersArray.length > 0 ? `providers: [${providersArray.join(',')}],` : ''
  }${componentFileContents.slice(
    componentDecoratorMetadataNode.getStart() + 1,
    moduleNodes[0].getStart() - 1
  )}`;

  tree.write(normalizedComponentPath, newComponentContents);

  const componentPathParts = parse(normalizedComponentPath);
  const pathToComponentSpec = joinPathFragments(
    componentPathParts.dir,
    '/',
    `${componentPathParts.name}.spec.ts`
  );

  if (tree.exists(pathToComponentSpec)) {
    const componentSpecContents = tree.read(pathToComponentSpec, 'utf-8');

    // Only support testbed based tests
    if (componentSpecContents.includes('TestBed')) {
      let newComponentSpecContents = componentSpecContents;

      if (componentSpecContents.includes('imports: [')) {
        newComponentSpecContents = newComponentSpecContents.replace(
          'imports: [',
          `imports: [${componentName}, `
        );
        newComponentSpecContents.replace(/declarations: \[.+/, '');
      } else {
        newComponentSpecContents = newComponentSpecContents.replace(
          'declarations: [',
          'imports: ['
        );
      }

      tree.write(pathToComponentSpec, newComponentSpecContents);
    }
  }
}
