import * as ts from 'typescript';
import { readFileSync } from 'fs';
import { ConfigExplainer } from './config-explainer';
import { diff } from 'jest-diff';

/**
 * It is important that the field level descriptions on the interface representing the Config which is being
 * explained stay in sync with the description on the relevant `ConfigExplainer` instance.
 *
 * Rather than dealing with the complexity of generating runtime information from the JSDoc types, or vice-versa,
 * at build time we have this unit test util to ensure that the descriptions in both places remain in sync.
 */
export function ensureDescriptionsMatch({
  fileContainingConfigInterface,
  configInterfaceName,
  configExplainer,
}: {
  fileContainingConfigInterface: string;
  configInterfaceName: string;
  configExplainer: ConfigExplainer<Record<string, unknown>>;
}) {
  const fileContents = readFileSync(fileContainingConfigInterface).toString();
  const sourceFile = ts.createSourceFile(
    fileContainingConfigInterface,
    fileContents,
    ts.ScriptTarget.Latest,
    false,
    ts.ScriptKind.TS
  );

  // Super quick upfront check to see if the given configInterfaceName is actually defined in the file
  if (!(sourceFile as any).identifiers.has(configInterfaceName)) {
    throw new Error(
      `Could not find the identifier ${configInterfaceName} in ${fileContainingConfigInterface}`
    );
  }

  let configTypeNode: ts.InterfaceDeclaration | undefined;

  ts.forEachChild(sourceFile, (node) => {
    if (
      !ts.isInterfaceDeclaration(node) ||
      node.name.escapedText !== configInterfaceName
    ) {
      return;
    }
    configTypeNode = node;
  });

  if (!configTypeNode) {
    throw new Error(
      `Could not find a type or interface declaration called ${configInterfaceName} in ${fileContainingConfigInterface}`
    );
  }

  for (const [
    key,
    { description: descriptionFromConfigExplainer },
  ] of Object.entries(configExplainer)) {
    const interfaceProperty = configTypeNode.members.find((node) => {
      if (
        !ts.isPropertySignature(node) ||
        !ts.isIdentifier(node.name) ||
        node.name.escapedText !== key
      ) {
        return false;
      }
      return true;
    });

    if (!interfaceProperty) {
      throw new Error(
        `Could not find a field called "${key}" on the interface ${configInterfaceName} in ${fileContainingConfigInterface}`
      );
    }

    const descriptionFromInterface = ts.getTextOfJSDocComment(
      (interfaceProperty as any).jsDoc[0].comment
    );

    const difference = diff(
      descriptionFromInterface,
      descriptionFromConfigExplainer
    );
    if (!difference.includes('Compared values have no visual difference.')) {
      throw new Error(
        `The description for the field "${key}" in the ConfigExplainer does not match the property on the interface ${configInterfaceName} in ${fileContainingConfigInterface}.\n\nSee the diff below:\n\n${difference}`
      );
    }
  }
}
