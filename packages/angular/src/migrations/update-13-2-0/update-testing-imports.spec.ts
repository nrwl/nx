import { readJson, Tree, writeJson } from '@nrwl/devkit';
import { createTree } from '@nrwl/devkit/testing';
import updateTestingImports from './update-testing-imports';

describe('await updateTestingImports', () => {
  let tree: Tree;
  beforeEach(() => {
    tree = createTree();
    writeJson(tree, 'package.json', {});
  });

  it('should remove hot', async () => {
    tree.write(
      'code.spec.ts',
      `
      import { hot } from '@nrwl/angular/testing';
      
      console.log(hot);
    
    `
    );

    await updateTestingImports(tree);

    const results = tree.read('code.spec.ts').toString();
    expect(results).toMatchInlineSnapshot(`
      "
      import { hot } from 'jasmine-marbles';
            
            console.log(hot);
          
          "
    `);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
  });

  it('should remove multiple identifiers', async () => {
    tree.write(
      'code.spec.ts',
      `
      import { hot, cold, getTestScheduler, readFirst, time } from '@nrwl/angular/testing';
      
      console.log(hot, cold, getTestScheduler, readFirst, time);
    
    `
    );

    await updateTestingImports(tree);

    const results = tree.read('code.spec.ts').toString();
    expect(results).toMatchInlineSnapshot(`
      "
            import { readFirst } from '@nrwl/angular/testing';
      import { hot, cold, getTestScheduler, time } from 'jasmine-marbles';
            
            console.log(hot, cold, getTestScheduler, readFirst, time);
          
          "
    `);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
  });

  it('should keep named specifiers', async () => {
    tree.write(
      'code.spec.ts',
      `
      import { readFirst as baseReadFirst } from '@nrwl/angular/testing';
      
      console.log(baseReadFirst);
    
    `
    );

    await updateTestingImports(tree);

    const results = tree.read('code.spec.ts').toString();
    expect(results).toMatchInlineSnapshot(`
      "
            import { readFirst as baseReadFirst } from '@nrwl/angular/testing';
            
            console.log(baseReadFirst);
          
          "
    `);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies?.['jasmine-marbles']).not.toBeDefined();
  });

  it('should handle duplicate imports', async () => {
    tree.write(
      'code.spec.ts',
      `
      import { hot } from '@nrwl/angular/testing';
      import { cold } from '@nrwl/angular/testing';
      
      console.log(hot, cold);
    
    `
    );

    await updateTestingImports(tree);

    const results = tree.read('code.spec.ts').toString();
    expect(results).toMatchInlineSnapshot(`
      "
      import { hot, cold } from 'jasmine-marbles';
            
            console.log(hot, cold);
          
          "
    `);

    const packageJson = readJson(tree, 'package.json');
    expect(packageJson.devDependencies['jasmine-marbles']).toBeDefined();
  });
});
