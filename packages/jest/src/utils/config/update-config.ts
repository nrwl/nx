import { Tree, applyChangesToString, ChangeType } from '@nrwl/devkit';
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
 */
export function addPropertyToJestConfig(
  host: Tree,
  path: string,
  propertyName: string,
  value: unknown
) {
  if (!host.exists(path)) {
    throw new Error(`Cannot find '${path}' in your workspace.`);
  }
  try {
    const configObject = jestConfigObjectAst(host.read(path).toString('utf-8'));
    const properties = propertyName.split('.');
    addOrUpdateProperty(
      host,
      configObject,
      properties,
      JSON.stringify(value),
      path
    );
  } catch (e) {
    console.warn(
      `Could not automatically add the following property to ${path}:`
    );
    console.warn(`${propertyName}: ${JSON.stringify(value)}`);
    console.log(`Please manually update ${path}`);
    console.warn(`Error: ${e.message}`);
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
    const configObject = jestConfigObjectAst(host.read(path).toString('utf-8'));
    const propertyAssignment = removeProperty(
      configObject,
      propertyName.split('.')
    );

    if (propertyAssignment) {
      const file = host.read(path).toString('utf-8');
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
    console.warn(
      `Could not automatically remove the '${propertyName}' property from ${path}:`
    );
    console.log(`Please manually update ${path}`);
  }
}
