import type { Tree } from 'nx/src/generators/tree';

export function getComponentDataFromAST(
  tree: Tree,
  normalizedComponentPath: string
) {
  const COMPONENT_CONTENT_SELECTOR =
    'ClassDeclaration:has(Decorator > CallExpression:has(Identifier[name=Component]))';
  const COMPONENT_NAME_SELECTOR =
    'ClassDeclaration:has(Decorator > CallExpression:has(Identifier[name=Component])) > Identifier';

  const componentFileContents = tree.read(normalizedComponentPath, 'utf-8');
  const { tsquery } = require('@phenomnomnominal/tsquery');
  const componentAST = tsquery.ast(componentFileContents);

  const componentNode = tsquery(componentAST, COMPONENT_CONTENT_SELECTOR, {
    visitAllChildren: true,
  })[0];
  const componentContents = componentFileContents.slice(
    componentNode.getStart(),
    componentNode.getEnd()
  );

  const componentNameNode = tsquery(
    tsquery.ast(componentContents),
    COMPONENT_NAME_SELECTOR,
    { visitAllChildren: true }
  )[0];
  const componentName = componentNameNode.getText();
  return { componentFileContents, componentAST, componentName };
}
