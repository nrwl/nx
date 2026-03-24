import { typeDefinitions } from './type-definitions';
describe('typeDefinitions', () => {
  it('should emit correct .d.ts filenames for various file formats', () => {
    const mockBundle = {
      'index.js': {
        type: 'chunk',
        isEntry: true,
        fileName: 'index.js',
        facadeModuleId: '/project/src/index.ts',
        exports: ['default', 'namedExport1', 'namedExport2'],
      },
      'index1.js': {
        type: 'chunk',
        isEntry: true,
        fileName: 'index.cjs',
        facadeModuleId: '/project/src/index.ts',
        exports: ['default', 'namedExport1', 'namedExport2'],
      },
      'index2.js': {
        type: 'chunk',
        isEntry: true,
        fileName: 'index.mjs',
        facadeModuleId: '/project/src/index.ts',
        exports: ['default', 'namedExport1', 'namedExport2'],
      },
      'index3.js': {
        type: 'chunk',
        isEntry: true,
        fileName: 'index.cjs.js',
        facadeModuleId: '/project/src/index.ts',
        exports: ['default', 'namedExport1', 'namedExport2'],
      },
      'index4.js': {
        type: 'chunk',
        isEntry: true,
        fileName: 'index.mjs.js',
        facadeModuleId: '/project/src/index.ts',
        exports: ['default', 'namedExport1', 'namedExport2'],
      },
    };

    const mockOpts = {}; // Can be left empty for this scenario

    const mockEmitFile = jest.fn();

    const plugin = typeDefinitions({ projectRoot: '/project' });

    // Simulate the `this` context of a Rollup plugin
    const mockContext = {
      emitFile: mockEmitFile,
    };

    // Run the plugin's `generateBundle` function
    (async function testPlugin() {
      await plugin.generateBundle.call(mockContext, mockOpts, mockBundle);

      // Verify the correct .d.ts filenames are generated for different file formats
      const expectedFileNames = [
        'index.d.ts', // from index.js
        'index.d.ts', // from index.cjs
        'index.d.ts', // from index.mjs
        'index.d.ts', // from index.cjs.js
        'index.d.ts', // from index.mjs.js
      ];

      mockEmitFile.mock.calls.forEach(([{ fileName }], index) => {
        expect(fileName).toBe(expectedFileNames[index]);
      });
    })();
  });

  it('should emit .d.ts files with relative references to source files', () => {
    const mockBundle = {
      'index.js': {
        type: 'chunk',
        isEntry: true,
        fileName: 'index.js',
        facadeModuleId: '/project/src/index.ts',
        exports: ['default'],
      },
      'entry-point.js': {
        type: 'chunk',
        isEntry: true,
        fileName: 'entry-point.js',
        facadeModuleId: '/project/src/entry-point1/entry-point.ts',
        exports: [],
      },
      'entry-point2/entry-point.js': {
        type: 'chunk',
        isEntry: true,
        fileName: 'entry-point2/entry-point.js',
        facadeModuleId: '/project/src/entry-point2/entry-point.ts',
        exports: ['default'],
      },
    };

    const mockOpts = {};

    const mockEmitFile = jest.fn();

    const plugin = typeDefinitions({ projectRoot: '/project' });

    const mockContext = {
      emitFile: mockEmitFile,
    };

    (async function testPlugin() {
      await plugin.generateBundle.call(mockContext, mockOpts, mockBundle);

      // The expected relative paths in the emitted .d.ts files should correctly reference the source .d.ts files
      const expectedReferences = [
        ['index.d.ts', './src/index', true], // for index.d.ts
        ['entry-point.d.ts', './src/entry-point1/entry-point', false], // for entry-point.d.ts
        [
          'entry-point2/entry-point.d.ts',
          '../src/entry-point2/entry-point',
          true,
        ], // for entry-point2/entry-point.d.ts
      ];

      mockEmitFile.mock.calls.forEach(([{ fileName }], index) => {
        const [expectedFileName, expectedRelativePath, expectDefaultExport] =
          expectedReferences[index];
        expect(fileName).toBe(expectedFileName);

        const emittedContent = mockEmitFile.mock.calls[index][0].source;
        expect(emittedContent).toContain(
          `export * from "${expectedRelativePath}";`
        );

        if (expectDefaultExport) {
          expect(emittedContent).toContain(
            `export { default } from "${expectedRelativePath}";`
          );
        } else {
          expect(emittedContent).not.toContain(
            `export { default } from "${expectedRelativePath}";`
          );
        }
      });
    })();
  });
});
