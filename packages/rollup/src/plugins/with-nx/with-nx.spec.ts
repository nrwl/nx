import { withNx } from './with-nx';

const ts = require('typescript');

describe('withNx', () => {
  afterEach(() => {
    delete global.NX_GRAPH_CREATION;
    vi.restoreAllMocks();
  });

  it('should not scan the workspace for a tsconfig during graph creation', () => {
    global.NX_GRAPH_CREATION = true;
    const readDirectory = vi.spyOn(ts.sys, 'readDirectory');

    const config = withNx({
      main: './src/index.ts',
      outputPath: 'dist/libs/a',
      tsConfig: './tsconfig.lib.json',
    });

    expect(readDirectory).not.toHaveBeenCalled();
    expect(config.output).toMatchInlineSnapshot(`
      [
        {
          "chunkFileNames": "[name].esm.js",
          "dir": "dist/libs/a",
          "entryFileNames": "[name].esm.js",
          "format": "esm",
          "sourcemap": undefined,
        },
      ]
    `);
  });
});
