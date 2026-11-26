import { Tree, applyChangesToString, ChangeType, logger } from '@nx/devkit';
import {
  addOrUpdateProperty,
  jestConfigObjectAst,
  removeProperty,
} from './functions';

/**
 * Add a property to the jest config
 * @param host
 * @param path - path to the jest config file
 * @param propertyName - Property to update. Can be dot delimited or an array to access deeply nested properties
 * @param value
 * @param options - set `valueAsString` option to true if the `value` being passed represents a string of the code that should be associated with the `propertyName`
 */
export function addPropertyToJestConfig(
  host: Tree,
  path: string,
  propertyName: string | string[],
  value: unknown,
  options: { valueAsString: boolean } = { valueAsString: false }
) {
  const contents = host.read(path, 'utf-8');
  if (contents === null) {
    throw new Error(`Cannot find '${path}' in your workspace.`);
  }
  const { propertyString, properties } = parsePropertyName(propertyName);
  try {
    const configObject = jestConfigObjectAst(contents);
    addOrUpdateProperty(
      host,
      configObject,
      properties,
      options.valueAsString ? value : JSON.stringify(value),
      path
    );
  } catch (e) {
    logger.info(`NX Please manually update ${path}`);
    logger.warn(
      `Could not automatically add the following property to ${path}:`
    );
    logger.warn(`${propertyString}: ${JSON.stringify(value)}`);
    logger.warn(`Error: ${e instanceof Error ? e.message : String(e)}`);
  }
}

/**
 * Remove a property value from the jest config
 * @param host
 * @param path
 * @param propertyName - Property to remove. Can be dot delimited or an array to access deeply nested properties
 */
export function removePropertyFromJestConfig(
  host: Tree,
  path: string,
  propertyName: string | string[]
) {
  const contents = host.read(path, 'utf-8');
  if (contents === null) {
    throw new Error(`Cannot find '${path}' in your workspace.`);
  }

  const { propertyString, properties } = parsePropertyName(propertyName);

  try {
    const configObject = jestConfigObjectAst(contents);
    const propertyAssignment = removeProperty(configObject, properties);

    if (propertyAssignment) {
      const commaNeeded = contents[propertyAssignment.end] === ',';
      const updatedFile = applyChangesToString(contents, [
        {
          type: ChangeType.Delete,
          start: propertyAssignment.getStart(),
          length: `${propertyAssignment.getText()}${commaNeeded ? ',' : ''}`
            .length,
        },
      ]);
      host.write(path, updatedFile);
      return;
    }
  } catch (e) {
    logger.info(`NX Please manually update ${path}`);
    logger.warn(
      `Could not automatically remove the '${propertyString}' property from ${path}:`
    );
  }
}

function parsePropertyName(propertyName: string | string[]) {
  return {
    properties: Array.isArray(propertyName)
      ? propertyName
      : propertyName.split('.'),
    propertyString: Array.isArray(propertyName)
      ? propertyName.join('.')
      : propertyName,
  };
}

export function addImportStatementToJestConfig(
  host: Tree,
  path: string,
  importStatement: string
) {
  const currentContents = host.read(path, 'utf-8');
  const newContents = `${importStatement}
  
${currentContents}`;
  host.write(path, newContents);
}
