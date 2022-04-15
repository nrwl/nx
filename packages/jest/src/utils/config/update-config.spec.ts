import {
  addPropertyToJestConfig,
  removePropertyFromJestConfig,
} from './update-config';
import { jestConfigObject } from './functions';
import { Tree } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';

describe('Update jest.config.js', () => {
  let host: Tree;

  beforeEach(() => {
    host = createTree();
    // create
    host.write(
      'jest.config.js',
      String.raw`
      module.exports = {
        name: 'test',
        boolean: false,
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
        },
        numeric: 0,
      }
    `
    );
  });

  describe('inserting or updating an existing property', () => {
    it('should be able to update an existing property with a primitive value ', () => {
      addPropertyToJestConfig(host, 'jest.config.js', 'name', 'test-case');

      let json = jestConfigObject(host, 'jest.config.js');
      expect(json.name).toBe('test-case');

      addPropertyToJestConfig(host, 'jest.config.js', 'boolean', true);
      json = jestConfigObject(host, 'jest.config.js');
      expect(json.boolean).toBe(true);

      addPropertyToJestConfig(host, 'jest.config.js', 'numeric', 1);
      json = jestConfigObject(host, 'jest.config.js');
      expect(json.numeric).toBe(1);
    });

    it('should be able to insert a new property with a primitive value', () => {
      addPropertyToJestConfig(host, 'jest.config.js', 'bail', 0);
      const json = jestConfigObject(host, 'jest.config.js');
      expect(json.bail).toBe(0);
    });

    it('it should be able to insert a new property with an array value', () => {
      const arrayValue = ['value', 'value2'];
      addPropertyToJestConfig(host, 'jest.config.js', 'myArrayProperty', [
        'value',
        'value2',
      ]);

      const json = jestConfigObject(host, 'jest.config.js');
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

      const json = jestConfigObject(host, 'jest.config.js');
      expect(json.myObjectProperty).toEqual(objectValue);
    });

    it('should be able to update an existing array', () => {
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingArray',
        'something new'
      );
      const json = jestConfigObject(host, 'jest.config.js');
      expect(json.alreadyExistingArray).toEqual(['something', 'something new']);
    });

    it('should not add duplicate values in an existing array', () => {
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingArray',
        'something'
      );
      const json = jestConfigObject(host, 'jest.config.js');
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
      const json = jestConfigObject(host, 'jest.config.js');
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
      const json = jestConfigObject(host, 'jest.config.js');
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
      const json = jestConfigObject(host, 'jest.config.js');
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
      let json = jestConfigObject(host, 'jest.config.js');
      expect(json['something-here']).toEqual('newPropertyValue');

      addPropertyToJestConfig(host, 'jest.config.js', 'update-me', 'goodbye');
      json = jestConfigObject(host, 'jest.config.js');
      expect(json['update-me']).toEqual('goodbye');
    });

    it('should modify a property with spread object syntax config', () => {
      host.write(
        'jest.config.js',
        String.raw`
       const { nxPreset } = require('@nrwl/jest/preset');
        
      module.exports = {
        ...nxPreset,
        name: 'test',
        boolean: false,
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
        },
        numeric: 0,
      }
    `
      );
      addPropertyToJestConfig(
        host,
        'jest.config.js',
        'something-here',
        'newPropertyValue'
      );
      let json = jestConfigObject(host, 'jest.config.js');
      expect(json['something-here']).toEqual('newPropertyValue');

      addPropertyToJestConfig(host, 'jest.config.js', 'update-me', 'goodbye');
      json = jestConfigObject(host, 'jest.config.js');
      expect(json['update-me']).toEqual('goodbye');
    });

    describe('warnings', () => {
      beforeEach(() => {
        jest.spyOn(console, 'warn');
      });

      it('should warn when trying to add a value to an already existing object without being dot delimited', () => {
        addPropertyToJestConfig(
          host,
          'jest.config.js',
          'alreadyExistingObject',
          'should fail'
        );
        expect(console.warn).toHaveBeenCalled();
      });

      it('should warn if the jest.config doesnt match module.exports = {} style', () => {
        host.write(
          'jest.unconventional.js',
          String.raw`
          jestObject = {
            stuffhere: true
          }
          
          module.exports = jestObject;
        `
        );
        addPropertyToJestConfig(
          host,
          'jest.unconventional.js',
          'stuffhere',
          'should fail'
        );
        expect(console.warn).toHaveBeenCalled();
      });

      it('should throw if the provided config does not exist in the tree', () => {
        expect(() => {
          addPropertyToJestConfig(host, 'jest.doesnotexist.js', '', '');
        }).toThrow();
      });
    });
  });

  describe('removing values', () => {
    it('should remove single nested properties in the jest config, ', () => {
      removePropertyFromJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingObject.nested-object.childArray'
      );
      const json = jestConfigObject(host, 'jest.config.js');
      expect(
        json['alreadyExistingObject']['nested-object']['childArray']
      ).toEqual(undefined);
    });
    it('should remove single properties', () => {
      removePropertyFromJestConfig(host, 'jest.config.js', 'update-me');
      const json = jestConfigObject(host, 'jest.config.js');
      expect(json['update-me']).toEqual(undefined);
    });
    it('should remove a whole object', () => {
      removePropertyFromJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingObject'
      );
      const json = jestConfigObject(host, 'jest.config.js');
      expect(json['alreadyExistingObject']).toEqual(undefined);
    });

    it('should remove property with a spread object syntax in config', () => {
      host.write(
        'jest.config.js',
        String.raw`
       const { nxPreset } = require('@nrwl/jest/preset');
        
      module.exports = {
        ...nxPreset,
        name: 'test',
        boolean: false,
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
        },
        numeric: 0,
      }
    `
      );
      removePropertyFromJestConfig(
        host,
        'jest.config.js',
        'alreadyExistingObject'
      );
      const json = jestConfigObject(host, 'jest.config.js');
      expect(json['alreadyExistingObject']).toEqual(undefined);
    });
  });
});
