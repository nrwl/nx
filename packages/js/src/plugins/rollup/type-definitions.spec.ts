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

      mockEmitFile.mock.calls.forEach(([{ fileName }]) => {
        expect(fileName).toBe('index.d.ts');
      });
    })();
  });
});
