import type { Tree } from '@nx/devkit';
import { createTreeWithEmptyWorkspace } from '@nx/devkit/testing';

import migrateMfeToMf, {
  renameSetupMfeGeneratorUsages,
  replaceExportedMFETypes,
  replaceNrwlAngularMfImport,
} from './migrate-mfe-to-mf';

describe('migrate-mfe-to-mf', () => {
  let tree: Tree;

  beforeEach(() => {
    tree = createTreeWithEmptyWorkspace({ layout: 'apps-libs' });
  });

  it('should replace any imports from nrwl/angular/mfe', () => {
    // ARRANGE
    const file = `import { loadRemoteModule } from '@nx/angular/mfe';
    // But not comments, or other markdown etc @nx/angular/mfe
    
    function something() {
      // but this should change
      import('@nx/angular/mfe');
    }
    `;

    // ACT
    const updatedFile = replaceNrwlAngularMfImport(file);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "import { loadRemoteModule } from '@nx/angular/mf';
          // But not comments, or other markdown etc @nx/angular/mfe
          
          function something() {
            // but this should change
            import('@nx/angular/mf');
          }
          "
    `);
  });

  it('should replace type imports from nrwl/angular/module-federation', () => {
    // ARRANGE
    const file = `import { MFERemotes } from '@nx/angular/module-federation';
    import { MFEConfig } from '@nx/angular/module-federation';
    
    const myValue: MFEConfig = {};
    const myRemotes: MFERemotes = [];
    
    function doSomething(v: MFERemotes): MFEConfig {};
    `;

    // ACT
    const updatedFile = replaceExportedMFETypes(file);

    // ASSERT
    expect(updatedFile).toMatchInlineSnapshot(`
      "import { MFRemotes } from '@nx/angular/module-federation';
          import { MFConfig } from '@nx/angular/module-federation';
          
          const myValue: MFConfig = {};
          const myRemotes: MFRemotes = [];
          
          function doSomething(v: MFRemotes): MFConfig {};
          "
    `);
  });

  it('should rename usages of setupMfe', () => {
    // ARRANGE
    const file = `import { setupMfe } from '@nx/angular/generators';
    import { setupMfe, somethingElse } from '@nx/angular/generators';
    
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
      "import { setupMf } from '@nx/angular/generators';
          import { setupMf, somethingElse } from '@nx/angular/generators';
          
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
      `import { loadRemoteModule } from '@nx/angular/mfe';
    // But not comments, or other markdown etc @nx/angular/mfe
    
    function something() {
      // but this should change
      import('@nx/angular/mfe');
    }`
    );

    tree.write(
      'test2.ts',
      `import { MFERemotes } from '@nx/angular/module-federation';
    import { MFEConfig } from '@nx/angular/module-federation';
    
    const myValue: MFEConfig = {};
    const myRemotes: MFERemotes = [];
    
    function doSomething(v: MFERemotes): MFEConfig {};
    `
    );

    tree.write(
      'apps/app1/test3.ts',
      `import { loadRemoteModule } from '@nx/angular/mfe';
    import { MFERemotes, MFEConfig } from '@nx/angular/module-federation';
    // But not comments, or other markdown etc @nx/angular/mfe
    
    function something() {
      // but this should change
      import('@nx/angular/mfe');
    }
    
    const myValue: MFEConfig = {};
    const myRemotes: MFERemotes = [];
    
    function doSomething(v: MFERemotes): MFEConfig {};
    `
    );

    tree.write(
      'libs/plugins/my-plugin/src/generators/my-generator.ts',
      `import { setupMfe } from '@nx/angular/generators';
    import { setupMfe, somethingElse } from '@nx/angular/generators';
    
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
      "import { loadRemoteModule } from '@nx/angular/mf';
          // But not comments, or other markdown etc @nx/angular/mfe
          
          function something() {
            // but this should change
            import('@nx/angular/mf');
          }"
    `);
    expect(tree.read('test2.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { MFRemotes } from '@nx/angular/module-federation';
          import { MFConfig } from '@nx/angular/module-federation';
          
          const myValue: MFConfig = {};
          const myRemotes: MFRemotes = [];
          
          function doSomething(v: MFRemotes): MFConfig {};
          "
    `);
    expect(tree.read('apps/app1/test3.ts', 'utf-8')).toMatchInlineSnapshot(`
      "import { loadRemoteModule } from '@nx/angular/mf';
          import { MFRemotes, MFConfig } from '@nx/angular/module-federation';
          // But not comments, or other markdown etc @nx/angular/mfe
          
          function something() {
            // but this should change
            import('@nx/angular/mf');
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
      "import { setupMf } from '@nx/angular/generators';
          import { setupMf, somethingElse } from '@nx/angular/generators';
          
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
