import { Tree, applyChangesToString, ChangeType, logger } from '@nrwl/devkit';
import {
  addOrUpdateProperty,
  jestConfigObjectAst,
  removeProperty,
} from './functions';

/**
 * Add a property to the jest config
 * @param host
 * @param path - path to the jest config file
 * @param propertyName - Property to update. Can be dot delimited to access deeply nested properties
 * @param value
 * @param options - set `valueAsString` option to true if the `value` being passed represents a string of the code that should be associated with the `propertyName`
 */
export function addPropertyToJestConfig(
  host: Tree,
  path: string,
  propertyName: string,
  value: unknown,
  options: { valueAsString: boolean } = { valueAsString: false }
) {
  if (!host.exists(path)) {
    throw new Error(`Cannot find '${path}' in your workspace.`);
  }
  try {
    const configObject = jestConfigObjectAst(host.read(path, 'utf-8'));
    const properties = propertyName.split('.');
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
    logger.warn(`${propertyName}: ${JSON.stringify(value)}`);
    logger.warn(`Error: ${e.message}`);
  }
}

/**
 * Remove a property value from the jest config
 * @param host
 * @param path
 * @param propertyName - Property to remove. Can be dot delimited to access deeply nested properties
 */
export function removePropertyFromJestConfig(
  host: Tree,
  path: string,
  propertyName: string
) {
  if (!host.exists(path)) {
    throw new Error(`Cannot find '${path}' in your workspace.`);
  }
  try {
    const configObject = jestConfigObjectAst(host.read(path, 'utf-8'));
    const propertyAssignment = removeProperty(
      configObject,
      propertyName.split('.')
    );

    if (propertyAssignment) {
      const file = host.read(path, 'utf-8');
      const commaNeeded = file[propertyAssignment.end] === ',';
      const updatedFile = applyChangesToString(file, [
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
      `Could not automatically remove the '${propertyName}' property from ${path}:`
    );
  }
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
