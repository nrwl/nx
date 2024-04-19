import { deleteMatchingProperties } from './plugin-migration-utils';
describe('Plugin Migration Utils', () => {
  describe('deleteMatchingProperties', () => {
    it('should delete properties that are identical between two different objects, leaving an empty object', () => {
      // ARRANGE
      const activeObject = {
        foo: 1,
        bar: 'myval',
        baz: {
          nested: {
            key: 'val',
          },
        },
        arr: ['string', 1],
      };

      const comparableObject = {
        foo: 1,
        bar: 'myval',
        baz: {
          nested: {
            key: 'val',
          },
        },
        arr: ['string', 1],
      };

      // ACT
      deleteMatchingProperties(activeObject, comparableObject);

      // ASSERT
      expect(activeObject).toMatchInlineSnapshot(`{}`);
    });

    it('should delete properties that are identical between two different objects, leaving an object containing only the differences', () => {
      // ARRANGE
      const activeObject = {
        foo: 1,
        bar: 'myval',
        baz: {
          nested: {
            key: 'differentValue',
          },
        },
        arr: ['string', 2],
      };

      const comparableObject = {
        foo: 1,
        bar: 'myval',
        baz: {
          nested: {
            key: 'val',
          },
        },
        arr: ['string', 1],
      };

      // ACT
      deleteMatchingProperties(activeObject, comparableObject);

      // ASSERT
      expect(activeObject).toMatchInlineSnapshot(`
        {
          "arr": [
            "string",
            2,
          ],
          "baz": {
            "nested": {
              "key": "differentValue",
            },
          },
        }
      `);
    });
  });
});
