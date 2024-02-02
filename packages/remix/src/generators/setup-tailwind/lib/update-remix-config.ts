import { joinPathFragments, type Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { getRemixConfigPathFromProjectRoot } from '../../../utils/remix-config';

export function updateRemixConfig(tree: Tree, projectRoot: string) {
  const pathToRemixConfig = getRemixConfigPathFromProjectRoot(
    tree,
    projectRoot
  );
  const fileContents = tree.read(pathToRemixConfig, 'utf-8');

  const REMIX_CONFIG_OBJECT_SELECTOR = 'ObjectLiteralExpression';
  const ast = tsquery.ast(fileContents);

  const nodes = tsquery(ast, REMIX_CONFIG_OBJECT_SELECTOR, {
    visitAllChildren: true,
  });
  if (nodes.length === 0) {
    throw new Error(`Remix Config is not valid, unable to update the file.`);
  }

  const configObjectNode = nodes[0];

  const propertyNodes = tsquery(configObjectNode, 'PropertyAssignment', {
    visitAllChildren: true,
  });

  for (const propertyNode of propertyNodes) {
    const nodeText = propertyNode.getText();
    if (nodeText.includes('tailwind') && nodeText.includes('true')) {
      return;
    } else if (nodeText.includes('tailwind') && nodeText.includes('false')) {
      const updatedFileContents = `${fileContents.slice(
        0,
        propertyNode.getStart()
      )}tailwind: true${fileContents.slice(propertyNode.getEnd())}`;
      tree.write(pathToRemixConfig, updatedFileContents);
      return;
    }
  }

  const updatedFileContents = `${fileContents.slice(
    0,
    configObjectNode.getStart() + 1
  )}\ntailwind: true,${fileContents.slice(configObjectNode.getStart() + 1)}`;

  tree.write(pathToRemixConfig, updatedFileContents);
}
