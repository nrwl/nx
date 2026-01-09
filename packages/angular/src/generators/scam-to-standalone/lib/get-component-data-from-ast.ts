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
  const { ast, query } = require('@phenomnomnominal/tsquery');
  const componentAST = ast(componentFileContents);

  const componentNode = query(componentAST, COMPONENT_CONTENT_SELECTOR)[0];
  const componentContents = componentFileContents.slice(
    componentNode.getStart(),
    componentNode.getEnd()
  );

  const componentNameNode = query(
    ast(componentContents),
    COMPONENT_NAME_SELECTOR
  )[0];
  const componentName = componentNameNode.getText();
  return { componentFileContents, componentAST, componentName };
}
