import { Tree } from '@angular-devkit/schematics';
import {
  addPropertyToJestConfig,
  getPropertyValueInJestConfig,
  jestConfigObject,
} from './update-config';
import * as stripJsonComments from 'strip-json-comments';
import * as ts from 'typescript';

function getJsonObj(node: ts.Node) {
  const nodeText = stripJsonComments(node.getFullText());
  return JSON.parse(JSON.stringify(eval(`(${nodeText})`)));
}

describe('Update jest.config.js', () => {
  let host: Tree;

  beforeEach(() => {
    host = Tree.empty();
    // create
    host.create(
      'jest.config.js',
      String.raw`
      module.exports = {
        name: 'test',
        boolean: false,
        numeric: 0,
        preset: 'nrwl-preset',
        "update-me": "hello",
        alreadyExistingArray: ['something'],
        alreadyExistingObject: {
          nestedProperty: {
            primitive: 'string',
            childArray: ['value1', 'value2']
          },
          'nested-object': {
            childArray: ['value1', 'value2']
          }
        }
      }
    `
    );
  });

  describe('inserting or updating an existing property', () => {
    it('should be able to update an existing property with a primitive value ', () => {
      addPropertyToJestConfig(host, 'jest.config.js', 'name', 'test-case');

      let moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      let json = getJsonObj(moduleObjectLiteral);
      expect(json.name).toBe('test-case');

      addPropertyToJestConfig(host, 'jest.config.js', 'boolean', true);
      moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      json = getJsonObj(moduleObjectLiteral);
      expect(json.boolean).toBe(true);

      addPropertyToJestConfig(host, 'jest.config.js', 'numeric', 1);
      moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      json = getJsonObj(moduleObjectLiteral);
      expect(json.numeric).toBe(1);
    });

    it('should be able to insert a new property with a primitive value', () => {
      addPropertyToJestConfig(host, 'jest.config.js', 'bail', 0);
      const moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      const json = getJsonObj(moduleObjectLiteral);
      expect(json.bail).toBe(0);
    });

    it('it should be able to insert a new property with an array value', () => {
      const arrayValue = ['value', 'value2'];
      addPropertyToJestConfig(host, 'jest.config.js', 'myArrayProperty', [
        'value',
        'value2',
      ]);

      const moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      const json = getJsonObj(moduleObjectLiteral);
      expect(json.myArrayProperty).toEqual(arrayValue);
    });

    it('should be able to insert a new property with an object value', () => {
      const objectValue = {
        'some-property': { config1: '1', config2: ['value1', 'value2'] },
      };
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'myObjectProperty',
        objectValue
      );

      const moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      const json = getJsonObj(moduleObjectLiteral);
      expect(json.myObjectProperty).toEqual(objectValue);
    });

    it('should be able to update an existing array', () => {
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingArray',
        'something new'
      );
      const moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      const json = getJsonObj(moduleObjectLiteral);
      expect(json.alreadyExistingArray).toEqual(['something', 'something new']);
    });

    it('should not add duplicate values in an existing array', () => {
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingArray',
        'something'
      );
      const moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      const json = getJsonObj(moduleObjectLiteral);
      expect(json.alreadyExistingArray).toEqual(['something']);
    });

    it('should be able to update an existing object', () => {
      const newPropertyValue = ['my new object'];
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingObject.something-new',
        newPropertyValue
      );
      const moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      const json = getJsonObj(moduleObjectLiteral);
      expect(json.alreadyExistingObject['something-new']).toEqual(
        newPropertyValue
      );
    });

    it('should be able to update an existing array in a nested object', () => {
      const newPropertyValue = 'new value';
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingObject.nestedProperty.childArray',
        newPropertyValue
      );
      const moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      const json = getJsonObj(moduleObjectLiteral);
      expect(json.alreadyExistingObject.nestedProperty.childArray).toEqual([
        'value1',
        'value2',
        newPropertyValue,
      ]);
    });

    it('should be able to update an existing value in a nested object', () => {
      const newPropertyValue = false;
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingObject.nestedProperty.primitive',
        newPropertyValue
      );
      const moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      const json = getJsonObj(moduleObjectLiteral);
      expect(json.alreadyExistingObject.nestedProperty.primitive).toEqual(
        newPropertyValue
      );
    });

    it('should be able to modify an object with a string identifier', () => {
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'something-here',
        'newPropertyValue'
      );
      let moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      let json = getJsonObj(moduleObjectLiteral);
      expect(json['something-here']).toEqual('newPropertyValue');

      addPropertyToJestConfig(host, 'jest.config.js', 'update-me', 'goodbye');
      moduleObjectLiteral = jestConfigObject(host, 'jest.config.js');
      json = getJsonObj(moduleObjectLiteral);
      expect(json['update-me']).toEqual('goodbye');
    });

    describe('errors', () => {
      it('should throw an error when trying to add a value to an already existing object without being dot delimited', () => {
        expect(() => {
          addPropertyToJestConfig(
            host,
            'jest.config.js',
            'alreadyExistingObject',
            'should fail'
          );
        }).toThrow();
      });

      it('should throw an error if the jest.config doesnt match module.exports = {} style', () => {
        host.create(
          'jest.unconventional.js',
          String.raw`
          jestObject = {
            stuffhere: true
          }
          
          module.exports = jestObject;
        `
        );
        expect(() => {
          addPropertyToJestConfig(
            host,
            'jest.unconventional.js',
            'stuffhere',
            'should fail'
          );
        }).toThrow();
      });

      it('should throw if the provided config does not exist in the tree', () => {
        expect(() => {
          addPropertyToJestConfig(host, 'jest.doesnotexist.js', '', '');
        }).toThrow();
      });
    });
  });

  describe('getting values', () => {
    it('should return a value that already exists', () => {
      let value = getPropertyValueInJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingArray'
      );
      expect(value).toEqual(['something']);

      value = getPropertyValueInJestConfig(host, 'jest.config.js', 'preset');
      expect(value).toEqual('nrwl-preset');

      value = getPropertyValueInJestConfig(host, 'jest.config.js', 'boolean');
      expect(value).toEqual(false);

      value = getPropertyValueInJestConfig(host, 'jest.config.js', 'numeric');
      expect(value).toEqual(0);

      value = getPropertyValueInJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingObject.nested-object.childArray'
      );
      expect(value).toEqual(['value1', 'value2']);
    });

    it('should return null if the property does not exist', () => {
      let value = getPropertyValueInJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingObject.nested-object.doesntexist'
      );
      expect(value).toEqual(null);

      value = getPropertyValueInJestConfig(
        host,
        'jest.config.js',
        'doesntexist'
      );
      expect(value).toEqual(null);
    });
  });
});
