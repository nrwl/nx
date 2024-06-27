import { Tree } from '@nx/devkit';
import { toProjectRelativePath } from '@nx/devkit/src/generators/plugin-migrations/plugin-migration-utils';
import { tsquery } from '@phenomnomnominal/tsquery';
import { interpolate } from 'nx/src/devkit-internals';
import * as ts from 'typescript';

export function updateNextConfig(
  tree: Tree,
  project: { projectName: string; root: string },
  options: {
    fileReplacements?: { replace: string; with: string }[];
    assets?: { input: string; output: string }[];
    outputPath?: string;
  } = {}
) {
  const defaultOptions = {
    fileReplacements: [],
    assets: [],
    outputPath: '.next',
  };

  const finalOptions = {
    assets: options.assets ?? defaultOptions.assets,
    fileReplacements:
      options.fileReplacements ?? defaultOptions.fileReplacements,
    outputPath: options.outputPath ?? defaultOptions.outputPath,
  };
  const configPath = `${project.root}/next.config.js`;
  const nextConfig = tree.read(configPath, 'utf-8');

  const ast = tsquery.ast(nextConfig);

  // find the nextConfig object assuming it is always defined
  const nextConfigQuery =
    'VariableDeclaration:has(Identifier[name=nextConfig]) ObjectLiteralExpression';

  const [nextConfigObject] = tsquery(ast, nextConfigQuery);

  if (nextConfigObject) {
    // find the nx object in the nextConfig object assuming it is always defined
    const nxQuery =
      'PropertyAssignment:has(Identifier[name=nx]) ObjectLiteralExpression';

    const [nxConfigObject] = tsquery(nextConfigObject, nxQuery);
    if (nxConfigObject) {
      const fileReplacementExists =
        tsquery(
          nxConfigObject,
          'PropertyAssignment:has(Identifier[name=fileReplacements])'
        ).length > 0;

      const assetsExists =
        tsquery(
          nxConfigObject,
          'PropertyAssignment:has(Identifier[name=assets])'
        ).length > 0;

      if (!fileReplacementExists && finalOptions.fileReplacements.length > 0) {
        // add fileReplacements to nextConfig
        const fileReplacementsProperty = finalOptions.fileReplacements.map(
          ({ replace: replacePath, with: withPath }) => {
            return {
              replace: toProjectRelativePath(replacePath, project.root),
              with: toProjectRelativePath(withPath, project.root),
            };
          }
        );

        nxConfigObject['properties'].push(
          createPropertyAssignment(
            'fileReplacements',
            createArrayLiteralExpression(fileReplacementsProperty)
          )
        );
      }

      if (!assetsExists && finalOptions.assets.length > 0) {
        const assetsProperty = finalOptions.assets.map((asset) => {
          return {
            ...asset,
            input: toProjectRelativePath(asset.input, project.root),
            output: toProjectRelativePath(asset.output, project.root),
          };
        });

        nxConfigObject['properties'].push(
          createPropertyAssignment(
            'assets',
            createArrayLiteralExpression(assetsProperty)
          )
        );
      }
    }
    const distDirExists =
      tsquery(nextConfig, 'PropertyAssignment:has(Identifier[name=distDir])')
        .length > 0;

    if (!distDirExists && finalOptions.outputPath !== '.next') {
      const updatedPath = interpolate(finalOptions.outputPath, {
        projectName: project.projectName,
        projectRoot: project.root,
        workspaceRoot: '',
      });

      nextConfigObject['properties'].push(
        createPropertyAssignment(
          'distDir',
          ts.factory.createStringLiteral(updatedPath)
        )
      );
    }

    const printer = ts.createPrinter();
    const result = ts.createSourceFile(
      configPath,
      '',
      ts.ScriptTarget.Latest,
      false,
      ts.ScriptKind.JS
    );
    const updatedConfigFileContents = printer.printNode(
      ts.EmitHint.Unspecified,
      ast,
      result
    );

    tree.write(`${project.root}/next.config.js`, updatedConfigFileContents);
  }
}

const createPropertyAssignment = (name, value) => {
  return ts.factory.createPropertyAssignment(
    ts.factory.createIdentifier(name),
    value
  );
};

const createArrayLiteralExpression = (elements: object[]) => {
  return ts.factory.createArrayLiteralExpression(
    elements.map((element) => {
      return ts.factory.createObjectLiteralExpression(
        Object.entries(element).map(([key, val]) =>
          createPropertyAssignment(key, ts.factory.createStringLiteral(val))
        ),
        true
      );
    }),
    true
  );
};
