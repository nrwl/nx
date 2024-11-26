import { type Tree, formatFiles, visitNotIgnoredFiles } from '@nx/devkit';
import { forEachExecutorOptions } from '@nx/devkit/src/generators/executor-options-utils';
import { minimatch } from 'minimatch';
import { tsquery } from '@phenomnomnominal/tsquery';

export default async function (tree: Tree) {
  visitNotIgnoredFiles(tree, '', (path) => {
    const webpackConfigGlob = '**/webpack*.config*.{js,ts,mjs,cjs}';
    const result = minimatch(path, webpackConfigGlob);
    if (!result) {
      return;
    }
    let webpackConfigContents = tree.read(path, 'utf-8');
    if (
      !/withModuleFederationSSR|withModuleFederation/.test(
        webpackConfigContents
      )
    ) {
      return;
    }

    const WITH_MODULE_FEDERATION_SELECTOR =
      'CallExpression:has(Identifier[name=withModuleFederation]),CallExpression:has(Identifier[name=withModuleFederationForSSR])';
    const EXISTING_MF_OVERRIDES_SELECTOR = 'ObjectLiteralExpression';

    const ast = tsquery.ast(webpackConfigContents);
    const withModuleFederationNodes = tsquery(
      ast,
      WITH_MODULE_FEDERATION_SELECTOR,
      { visitAllChildren: true }
    );
    if (!withModuleFederationNodes.length) {
      return;
    }

    const withModuleFederationNode = withModuleFederationNodes[0];
    const existingOverridesNodes = tsquery(
      withModuleFederationNode,
      EXISTING_MF_OVERRIDES_SELECTOR,
      { visitAllChildren: true }
    );
    if (!existingOverridesNodes.length) {
      // doesn't exist, add it
      webpackConfigContents = `${webpackConfigContents.slice(
        0,
        withModuleFederationNode.getEnd() - 1
      )},${JSON.stringify({ dts: false })}${webpackConfigContents.slice(
        withModuleFederationNode.getEnd() - 1
      )}`;
    } else {
      let existingOverrideNode;
      for (const node of existingOverridesNodes) {
        if (!existingOverrideNode) {
          existingOverrideNode = node;
        }
        if (existingOverrideNode.getText().includes(node.getText())) {
          continue;
        }
        existingOverrideNode = node;
      }
      const DTS_PROPERTY_SELECTOR = 'PropertyAssignment > Identifier[name=dts]';
      const dtsPropertyNode = tsquery(
        existingOverrideNode,
        DTS_PROPERTY_SELECTOR
      );
      if (dtsPropertyNode.length) {
        // dts already exists, do nothing
        return;
      }

      const newOverrides = `{ dts: false, ${existingOverrideNode
        .getText()
        .slice(1)}`;
      webpackConfigContents = `${webpackConfigContents.slice(
        0,
        existingOverrideNode.getStart()
      )}${newOverrides}${webpackConfigContents.slice(
        existingOverrideNode.getEnd()
      )}`;
    }
    tree.write(path, webpackConfigContents);
  });

  await formatFiles(tree);
}
