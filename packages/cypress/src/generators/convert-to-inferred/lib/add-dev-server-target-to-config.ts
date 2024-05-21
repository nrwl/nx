import type { Tree } from '@nx/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';

/**
 * Add or update the webServerCommands and ciWebServerCommand options in the Cypress Config
 * Scenarios Covered:
 *  1. Only devServerTarget Exists
 *  2. devServerTarget and configuration.ci.devServerTarget Exists
 *
 *  For each, the following scenarios are covered:
 *  a. The command is not listed in the config, so it is added
 *  b. Replace the existing webServerCommands with the value passed in
 */
export function addDevServerTargetToConfig(
  tree: Tree,
  configFilePath: string,
  webServerCommands: Record<string, string>,
  ciDevServerTarget?: string
) {
  let configFileContents = tree.read(configFilePath, 'utf-8');

  let ast = tsquery.ast(configFileContents);

  const NX_E2E_PRESET_SELECTOR =
    'PropertyAssignment:has(Identifier[name=e2e]) CallExpression:has(Identifier[name=nxE2EPreset])';
  const nxE2ePresetOptionsNodes = tsquery(ast, NX_E2E_PRESET_SELECTOR, {
    visitAllChildren: true,
  });
  if (nxE2ePresetOptionsNodes.length !== 0) {
    const NX_E2E_PRESET_OPTIONS_SELECTOR =
      'PropertyAssignment:has(Identifier[name=e2e]) CallExpression:has(Identifier[name=nxE2EPreset]) > ObjectLiteralExpression';
    const optionsObjectNodes = tsquery(ast, NX_E2E_PRESET_OPTIONS_SELECTOR, {
      visitAllChildren: true,
    });
    const hasObjectDefinition = optionsObjectNodes?.length > 0;

    let nxE2ePresetOptionsNode = nxE2ePresetOptionsNodes[0];
    const WEB_SERVER_COMMANDS_SELECTOR =
      'PropertyAssignment:has(Identifier[name=webServerCommands])';
    const webServerCommandsNodes = tsquery(
      nxE2ePresetOptionsNode,
      WEB_SERVER_COMMANDS_SELECTOR,
      { visitAllChildren: true }
    );
    if (webServerCommandsNodes.length !== 0) {
      // Already exists, replace it
      tree.write(
        configFilePath,
        `${configFileContents.slice(
          0,
          webServerCommandsNodes[0].getStart()
        )}webServerCommands: ${JSON.stringify(
          webServerCommands
        )}${configFileContents.slice(webServerCommandsNodes[0].getEnd())}`
      );
    } else {
      if (hasObjectDefinition) {
        tree.write(
          configFilePath,
          `${configFileContents.slice(
            0,
            optionsObjectNodes[0].getStart() + 1
          )}webServerCommands: ${JSON.stringify(
            webServerCommands
          )},${configFileContents.slice(optionsObjectNodes[0].getStart() + 1)}`
        );
      } else {
        tree.write(
          configFilePath,
          `${configFileContents.slice(
            0,
            nxE2ePresetOptionsNode.getEnd() - 1
          )},{ webServerCommands: ${JSON.stringify(
            webServerCommands
          )},}${configFileContents.slice(nxE2ePresetOptionsNode.getEnd() - 1)}`
        );
      }
    }

    if (ciDevServerTarget) {
      configFileContents = tree.read(configFilePath, 'utf-8');
      ast = tsquery.ast(configFileContents);
      nxE2ePresetOptionsNode = tsquery(ast, NX_E2E_PRESET_SELECTOR, {
        visitAllChildren: true,
      })[0];

      const NX_E2E_PRESET_OPTIONS_SELECTOR =
        'PropertyAssignment:has(Identifier[name=e2e]) CallExpression:has(Identifier[name=nxE2EPreset]) > ObjectLiteralExpression';
      const optionsObjectNodes = tsquery(ast, NX_E2E_PRESET_OPTIONS_SELECTOR, {
        visitAllChildren: true,
      });
      const hasObjectDefinition = optionsObjectNodes?.length > 0;

      const CI_WEB_SERVER_COMMANDS_SELECTOR =
        'PropertyAssignment:has(Identifier[name=ciWebServerCommand])';
      const ciWebServerCommandsNodes = tsquery(
        nxE2ePresetOptionsNode,
        CI_WEB_SERVER_COMMANDS_SELECTOR,
        { visitAllChildren: true }
      );

      if (ciWebServerCommandsNodes.length !== 0) {
        const ciWebServerCommandNode =
          ciWebServerCommandsNodes[0].getChildAt(2);
        const ciWebServerCommand = ciWebServerCommandNode
          .getText()
          .replace(/["']/g, '');
        if (!ciWebServerCommand.includes(ciDevServerTarget)) {
          tree.write(
            configFilePath,
            `${configFileContents.slice(
              0,
              ciWebServerCommandNode.getStart()
            )}"${ciDevServerTarget}"${configFileContents.slice(
              ciWebServerCommandNode.getEnd()
            )}`
          );
        }
      } else {
        if (hasObjectDefinition) {
          tree.write(
            configFilePath,
            `${configFileContents.slice(
              0,
              optionsObjectNodes[0].getStart() + 1
            )}ciWebServerCommand: "${ciDevServerTarget}",${configFileContents.slice(
              optionsObjectNodes[0].getStart() + 1
            )}`
          );
        } else {
          tree.write(
            configFilePath,
            `${configFileContents.slice(
              0,
              nxE2ePresetOptionsNode.getEnd() - 1
            )},{ ciWebServerCommand: "${ciDevServerTarget}",}${configFileContents.slice(
              nxE2ePresetOptionsNode.getEnd() - 1
            )}`
          );
        }
      }
    }
  }
}
