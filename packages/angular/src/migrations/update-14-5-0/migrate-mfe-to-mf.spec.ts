import type { Tree } from '@nrwl/devkit';
import { createTreeWithEmptyWorkspace } from '@nrwl/devkit/testing';

import migrateMfeToMf, {
  renameSetupMfeGeneratorUsages,
  replaceExportedMFETypes,
  replaceNrwlAngularMfImport,
} from './migrate-mfe-to-mf';

describe('migrate-mfe-to-mf', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace(2);
  });

  it('should replace any imports from nrwl/angular/mfe', () => {
    // ARRANGE
    const file = `import { loadRemoteModule } from '@nrwl/angular/mfe';
    // But not comments, or other markdown etc @nrwl/angular/mfe
    
    function something() {
      // but this should change
      import('@nrwl/angular/mfe');
    }
    `;

    // ACT
    const updatedFile = replaceNrwlAngularMfImport(file);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "import { loadRemoteModule } from '@nrwl/angular/mf';
          // But not comments, or other markdown etc @nrwl/angular/mfe
          
          function something() {
            // but this should change
            import('@nrwl/angular/mf');
          }
          "
    `);
  });

  it('should replace type imports from nrwl/angular/module-federation', () => {
    // ARRANGE
    const file = `import { MFERemotes } from '@nrwl/angular/module-federation';
    import { MFEConfig } from '@nrwl/angular/module-federation';
    
    const myValue: MFEConfig = {};
    const myRemotes: MFERemotes = [];
    
    function doSomething(v: MFERemotes): MFEConfig {};
    `;

    // ACT
    const updatedFile = replaceExportedMFETypes(file);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "import { MFRemotes } from '@nrwl/angular/module-federation';
          import { MFConfig } from '@nrwl/angular/module-federation';
          
          const myValue: MFConfig = {};
          const myRemotes: MFRemotes = [];
          
          function doSomething(v: MFRemotes): MFConfig {};
          "
    `);
  });

  it('should rename usages of setupMfe', () => {
    // ARRANGE
    const file = `import { setupMfe } from '@nrwl/angular/generators';
    import { setupMfe, somethingElse } from '@nrwl/angular/generators';
    
    function doSomething(v: MFERemotes): MFEConfig {
    
      setupMfe();
      
      setupMfe({
        mfeType: 'doSomething'
      })
    
    };
    `;

    // ACT
    const updatedFile = renameSetupMfeGeneratorUsages(file);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "import { setupMf } from '@nrwl/angular/generators';
          import { setupMf, somethingElse } from '@nrwl/angular/generators';
          
          function doSomething(v: MFERemotes): MFEConfig {
          
            setupMf();
            
            setupMf({
              mfType: 'doSomething'
            })
          
          };
          "
    `);
  });

  it('should update files correctly', async () => {
    // ARRANGE
    tree.write(
      'test1.js',
      `import { loadRemoteModule } from '@nrwl/angular/mfe';
    // But not comments, or other markdown etc @nrwl/angular/mfe
    
    function something() {
      // but this should change
      import('@nrwl/angular/mfe');
    }`
    );

    tree.write(
      'test2.ts',
      `import { MFERemotes } from '@nrwl/angular/module-federation';
    import { MFEConfig } from '@nrwl/angular/module-federation';
    
    const myValue: MFEConfig = {};
    const myRemotes: MFERemotes = [];
    
    function doSomething(v: MFERemotes): MFEConfig {};
    `
    );

    tree.write(
      'apps/app1/test3.ts',
      `import { loadRemoteModule } from '@nrwl/angular/mfe';
    import { MFERemotes, MFEConfig } from '@nrwl/angular/module-federation';
    // But not comments, or other markdown etc @nrwl/angular/mfe
    
    function something() {
      // but this should change
      import('@nrwl/angular/mfe');
    }
    
    const myValue: MFEConfig = {};
    const myRemotes: MFERemotes = [];
    
    function doSomething(v: MFERemotes): MFEConfig {};
    `
    );

    tree.write(
      'libs/plugins/my-plugin/src/generators/my-generator.ts',
      `import { setupMfe } from '@nrwl/angular/generators';
    import { setupMfe, somethingElse } from '@nrwl/angular/generators';
    
    function doSomething(v: MFERemotes): MFEConfig {
    
      setupMfe();
      
      setupMfe({
        mfeType: 'doSomething'
      })
    
    };
    `
    );

    // ACT

    await migrateMfeToMf(tree);

    // ASSERT
    expect(tree.read('test1.js', 'utf-8')).toMatchInlineSnapshot(`
      "import { loadRemoteModule } from '@nrwl/angular/mf';
          // But not comments, or other markdown etc @nrwl/angular/mfe
          
          function something() {
            // but this should change
            import('@nrwl/angular/mf');
          }"
    `);
    expect(tree.read('test2.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { MFRemotes } from '@nrwl/angular/module-federation';
          import { MFConfig } from '@nrwl/angular/module-federation';
          
          const myValue: MFConfig = {};
          const myRemotes: MFRemotes = [];
          
          function doSomething(v: MFRemotes): MFConfig {};
          "
    `);
    expect(tree.read('apps/app1/test3.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { loadRemoteModule } from '@nrwl/angular/mf';
          import { MFRemotes, MFConfig } from '@nrwl/angular/module-federation';
          // But not comments, or other markdown etc @nrwl/angular/mfe
          
          function something() {
            // but this should change
            import('@nrwl/angular/mf');
          }
          
          const myValue: MFConfig = {};
          const myRemotes: MFRemotes = [];
          
          function doSomething(v: MFRemotes): MFConfig {};
          "
    `);
    expect(
      tree.read(
        'libs/plugins/my-plugin/src/generators/my-generator.ts',
        'utf-8'
      )
    ).toMatchInlineSnapshot(`
      "import { setupMf } from '@nrwl/angular/generators';
          import { setupMf, somethingElse } from '@nrwl/angular/generators';
          
          function doSomething(v: MFERemotes): MFEConfig {
          
            setupMf();
            
            setupMf({
              mfType: 'doSomething'
            })
          
          };
          "
    `);
  });
});
