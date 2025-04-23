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
      "
        import { createConfig }from '@nx/angular-rspack';
        
        
        export default createConfig({ 
          options: {
            root: __dirname,
            
        "index": "src/index.html",
        "browser": "src/main.ts",
        "tsconfigPath": "tsconfig.app.json",
        "polyfills": [
          "zone.js"
        ],
        "assets": [
          "public"
        ],
        "styles": [
          "src/styles.css"
        ],
        "scripts": [],
        "jit": false,
        "inlineStylesExtension": "css",
        "fileReplacements": [],
        "hasServer": false,
        "skipTypeChecking": false

          }
        });"
    `);
  });

  it('should create a config file with configurations', () => {
    const tree = createTreeWithEmptyWorkspace();
    const opts = {
      root: 'root',
      index: 'src/index.html',
      browser: 'src/main.ts',
    };
    const configurationOptions = {
      production: {
        index: 'src/index.prod.html',
        browser: 'src/main.prod.ts',
      },
    };
    createConfig(tree, opts, configurationOptions);
    expect(tree.read('root/rspack.config.ts', 'utf-8')).toMatchInlineSnapshot(`
      "
        import { createConfig }from '@nx/angular-rspack';
        
        
        export default createConfig({ 
          options: {
            root: __dirname,
            
        "index": "src/index.html",
        "browser": "src/main.ts"

          }
        }, {
            "production": {
              options: {
                
        "index": "src/index.prod.html",
        "browser": "src/main.prod.ts"

              }
            }});"
    `);
  });
});
