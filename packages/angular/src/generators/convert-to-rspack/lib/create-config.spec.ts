import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';
import { createConfig } from './create-config';

describe('createConfig', () => {
  it('should create a config file', () => {
    const tree = createTreeWithEmptyWorkspace();
    const opts = {
      root: 'root',
      index: 'src/index.html',
      browser: 'src/main.ts',
      tsconfigPath: 'tsconfig.app.json',
      polyfills: ['zone.js'],
      assets: ['public'],
      styles: ['src/styles.css'],
      scripts: [],
      jit: false,
      inlineStylesExtension: 'css',
      fileReplacements: [],
      hasServer: false,
      skipTypeChecking: false,
    };
    createConfig(tree, opts);
    expect(tree.read('root/rspack.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "const { createConfig } = require('@ng-rspack/build');
        
        
        module.exports = createConfig({
          root: __dirname,
          index: './src/index.html',
          browser: './src/main.ts',
          
          
          tsconfigPath: './tsconfig.app.json',
          polyfills: ["zone.js"],
          assets: ["./public"],
          styles: ["./src/styles.css"],
          scripts: [],
          jit: false,
          inlineStylesExtension: 'css',
          fileReplacements: [],
          hasServer: false,
          skipTypeChecking: false,
        });
        
        "
    `);
  });
});
