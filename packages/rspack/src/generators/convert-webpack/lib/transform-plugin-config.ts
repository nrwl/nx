import { type Tree } from '@nx/devkit';
import { tsquery } from '@nx/devkit/internal';

export function transformPluginConfig(tree: Tree, configPath: string) {
  let contents = tree.read(configPath, 'utf-8');
  const sourceFile = tsquery.ast(contents);
  const replacements: { start: number; end: number; text: string }[] = [];

  for (const [source, destination, fromClass, toClass] of [
    [
      '@nx/webpack/app-plugin',
      '@nx/rspack/app-plugin',
      'NxAppWebpackPlugin',
      'NxAppRspackPlugin',
    ],
    [
      '@nx/react/webpack-plugin',
      '@nx/rspack/react-plugin',
      'NxReactWebpackPlugin',
      'NxReactRspackPlugin',
    ],
  ]) {
    const imports = tsquery.query(
      sourceFile,
      `ImportDeclaration > StringLiteral[value="${source}"], CallExpression:has(Identifier[name=require]) > StringLiteral[value="${source}"]`
    );
    if (!imports.length) continue;
    for (const node of imports) {
      replacements.push({
        start: node.getStart(),
        end: node.getEnd(),
        text: `'${destination}'`,
      });
    }
    for (const node of tsquery.query(
      sourceFile,
      `Identifier[name=${fromClass}]`
    )) {
      replacements.push({
        start: node.getStart(),
        end: node.getEnd(),
        text: toClass,
      });
    }
  }

  for (const node of tsquery.query(
    sourceFile,
    'ImportDeclaration > StringLiteral[value=webpack]'
  )) {
    replacements.push({
      start: node.getStart(),
      end: node.getEnd(),
      text: "'@rspack/core'",
    });
  }
  for (const { start, end, text } of replacements.sort(
    (a, b) => b.start - a.start
  )) {
    contents = contents.slice(0, start) + text + contents.slice(end);
  }
  tree.write(configPath, contents);
}
