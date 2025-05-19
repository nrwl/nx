import { formatFiles, type Tree } from '@nx/devkit';
import { ensureTypescript } from '@nx/js/src/utils/typescript/ensure-typescript';
import { tsquery } from '@phenomnomnominal/tsquery';
import type { Printer } from 'typescript';
import { resolveCypressConfigObject } from '../../utils/config';
import { cypressProjectConfigs } from '../../utils/migrations';

let printer: Printer;
let ts: typeof import('typescript');

// https://docs.cypress.io/app/references/changelog#:~:text=The%20experimentalFetchPolyfill%20configuration%20option%20was,cy.intercept()%20for%20handling%20fetch%20requests
export default async function (tree: Tree) {
  for await (const { cypressConfigPath } of cypressProjectConfigs(tree)) {
    if (!tree.exists(cypressConfigPath)) {
      // cypress config file doesn't exist, so skip
      continue;
    }

    ts ??= ensureTypescript();
    printer ??= ts.createPrinter();

    const cypressConfig = tree.read(cypressConfigPath, 'utf-8');
    const updatedConfig = removeExperimentalFetchPolyfill(cypressConfig);

    tree.write(cypressConfigPath, updatedConfig);
  }

  await formatFiles(tree);
}

function removeExperimentalFetchPolyfill(cypressConfig: string): string {
  const config = resolveCypressConfigObject(cypressConfig);

  if (!config) {
    // couldn't find the config object, leave as is
    return cypressConfig;
  }

  const sourceFile = tsquery.ast(cypressConfig);

  const updatedConfig = ts.factory.updateObjectLiteralExpression(
    config,
    config.properties
      // remove the experimentalFetchPolyfill property from the top level config object
      .filter(
        (p) =>
          !ts.isPropertyAssignment(p) ||
          p.name.getText() !== 'experimentalFetchPolyfill'
      )
      .map((p) => {
        if (
          ts.isPropertyAssignment(p) &&
          ['component', 'e2e'].includes(p.name.getText()) &&
          ts.isObjectLiteralExpression(p.initializer)
        ) {
          // remove the experimentalFetchPolyfill property from the component or e2e config object
          return ts.factory.updatePropertyAssignment(
            p,
            p.name,
            ts.factory.updateObjectLiteralExpression(
              p.initializer,
              p.initializer.properties.filter(
                (ip) =>
                  !ts.isPropertyAssignment(ip) ||
                  ip.name.getText() !== 'experimentalFetchPolyfill'
              )
            )
          );
        }

        return p;
      })
  );

  return cypressConfig.replace(
    config.getText(),
    printer.printNode(ts.EmitHint.Unspecified, updatedConfig, sourceFile)
  );
}
