import { Tree } from '@angular-devkit/schematics';
import { insert, RemoveChange } from '@nrwl/workspace';
import {
  addOrUpdateProperty,
  getProperty,
  jestConfigObject,
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
  const configObject = jestConfigObject(host, path);
  const properties = propertyName.split('.');
  const changes = addOrUpdateProperty(
    configObject,
    properties,
    JSON.stringify(value),
    path
  );
  insert(host, path, changes);
}

/**
 * Get a property value from the jest config
 * @param host
 * @param path
 * @param propertyName - Property to retrieve. Can be dot delimited to access deeply nested properties
 */
export function getPropertyValueInJestConfig(
  host: Tree,
  path: string,
  propertyName: string
): unknown {
  const configObject = jestConfigObject(host, path);
  const propertyAssignment = getProperty(configObject, propertyName.split('.'));

  if (propertyAssignment) {
    return JSON.parse(
      propertyAssignment.initializer.getText().replace(/'/g, '"')
    );
  } else {
    return null;
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
  const configObject = jestConfigObject(host, path);
  const propertyAssignment = getProperty(configObject, propertyName.split('.'));

  if (propertyAssignment) {
    const file = host.read(path).toString('utf-8');
    const commaNeeded = file[propertyAssignment.end] === ',';
    insert(host, path, [
      new RemoveChange(
        path,
        propertyAssignment.getStart(),
        `${propertyAssignment.getText()}${commaNeeded ? ',' : ''}`
      ),
    ]);
  }
}
