import {
  deleteMatchingProperties,
  processTargetOutputs,
} from './plugin-migration-utils';
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

  describe('processTargetOutputs', () => {
    it('should delete the target outputs when they all match the inferred task outputs', () => {
      const target = {
        outputs: [
          '{workspaceRoot}/{options.outputFile}',
          '{workspaceRoot}/{options.outputDir}',
        ],
      };
      const inferredTarget = {
        outputs: [
          '{projectRoot}/{options.outputFile}',
          '{projectRoot}/{options.outputDir}',
        ],
      };

      processTargetOutputs(target, [], inferredTarget, {
        projectName: 'proj1',
        projectRoot: 'proj1',
      });

      expect(target.outputs).toBeUndefined();
    });

    it('should delete the target outputs when they are a subset of those of the inferred task', () => {
      const target = {
        outputs: ['{workspaceRoot}/{options.outputDir}'],
      };
      const inferredTarget = {
        outputs: [
          '{projectRoot}/{options.outputFile}',
          '{projectRoot}/{options.outputDir}',
        ],
      };

      processTargetOutputs(target, [], inferredTarget, {
        projectName: 'proj1',
        projectRoot: 'proj1',
      });

      expect(target.outputs).toBeUndefined();
    });

    it('should update target outputs when it has any output that is not inferred', () => {
      const target = {
        outputs: [
          '{workspaceRoot}/{options.outputFile}',
          '{workspaceRoot}/{options.outputDir}',
        ],
      };
      const inferredTarget = {
        outputs: ['{projectRoot}/{options.outputFile}'],
      };

      processTargetOutputs(target, [], inferredTarget, {
        projectName: 'proj1',
        projectRoot: 'proj1',
      });

      expect(target.outputs).toStrictEqual([
        '{projectRoot}/{options.outputFile}',
        '{projectRoot}/{options.outputDir}',
      ]);
    });

    it('should merge extra inferred outputs when it has any output that is not inferred', () => {
      const target = {
        outputs: [
          '{workspaceRoot}/{options.outputDir}',
          '{workspaceRoot}/some/other/output',
        ],
      };
      const inferredTarget = {
        outputs: [
          '{projectRoot}/{options.outputFile}',
          '{projectRoot}/{options.outputDir}',
        ],
      };

      processTargetOutputs(target, [], inferredTarget, {
        projectName: 'proj1',
        projectRoot: 'proj1',
      });

      expect(target.outputs).toStrictEqual([
        '{projectRoot}/{options.outputDir}',
        '{workspaceRoot}/some/other/output',
        '{projectRoot}/{options.outputFile}',
      ]);
    });

    describe('with renamed output options', () => {
      it('should delete the target outputs when they all match the inferred task outputs', () => {
        const target = {
          outputs: [
            '{workspaceRoot}/{options.outputFile}',
            '{workspaceRoot}/{options.outputPath}',
          ],
        };
        const inferredTarget = {
          outputs: [
            '{projectRoot}/{options.outputFile}',
            '{projectRoot}/{options.outputDir}',
          ],
        };

        processTargetOutputs(
          target,
          [{ newName: 'outputDir', oldName: 'outputPath' }],
          inferredTarget,
          { projectName: 'proj1', projectRoot: 'proj1' }
        );

        expect(target.outputs).toBeUndefined();
      });

      it('should delete the target outputs when they are a subset of those of the inferred task', () => {
        const target = {
          outputs: ['{workspaceRoot}/{options.outputPath}'],
        };
        const inferredTarget = {
          outputs: [
            '{projectRoot}/{options.outputFile}',
            '{projectRoot}/{options.outputDir}',
          ],
        };

        processTargetOutputs(
          target,
          [{ newName: 'outputDir', oldName: 'outputPath' }],
          inferredTarget,
          { projectName: 'proj1', projectRoot: 'proj1' }
        );

        expect(target.outputs).toBeUndefined();
      });

      it('should update target outputs when it has any output that is not inferred', () => {
        const target = {
          outputs: [
            '{workspaceRoot}/{options.outputFile}',
            '{workspaceRoot}/{options.outputPath}',
          ],
        };
        const inferredTarget = {
          outputs: ['{projectRoot}/{options.outputFile}'],
        };

        processTargetOutputs(
          target,
          [{ newName: 'outputDir', oldName: 'outputPath' }],
          inferredTarget,
          { projectName: 'proj1', projectRoot: 'proj1' }
        );

        expect(target.outputs).toStrictEqual([
          '{projectRoot}/{options.outputFile}',
          '{projectRoot}/{options.outputDir}',
        ]);
      });

      it('should merge extra inferred outputs when it has any output that is not inferred', () => {
        const target = {
          outputs: [
            '{workspaceRoot}/{options.outputPath}',
            '{workspaceRoot}/some/other/output',
          ],
        };
        const inferredTarget = {
          outputs: [
            '{projectRoot}/{options.outputFile}',
            '{projectRoot}/{options.outputDir}',
          ],
        };

        processTargetOutputs(
          target,
          [{ newName: 'outputDir', oldName: 'outputPath' }],
          inferredTarget,
          { projectName: 'proj1', projectRoot: 'proj1' }
        );

        expect(target.outputs).toStrictEqual([
          '{projectRoot}/{options.outputDir}',
          '{workspaceRoot}/some/other/output',
          '{projectRoot}/{options.outputFile}',
        ]);
      });
    });
  });
});
