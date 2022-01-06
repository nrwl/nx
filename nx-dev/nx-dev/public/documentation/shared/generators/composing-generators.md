# Composing Generators

Generators are useful individually, but reusing and composing generators allows you to build whole workflows out of simpler building blocks.

## Using Nx Devkit Generators

Nx Devkit generators can be imported and invoked like any javascript function. They often return a `Promise`, so they can be used with the `await` keyword to mimic synchronous code. Because this is standard javascript, control flow logic can be adjusted with `if` blocks and `for` loops as usual.

```typescript
import { libraryGenerator } from '@nrwl/workspace';

export default async function (tree: Tree, schema: any) {
  await libraryGenerator(
    tree, // virtual file system tree
    { name: schema.name } // options for the generator
  );
}
```

## Using jscodeshift Codemods

Codemods created for use with [`jscodeshift`](https://github.com/facebook/jscodeshift) can be used within Nx Devkit generators using the `visitNotIgnoredFiles` helper function. This way you can compose codemods with other generators while retaining `--dry-run` and Nx Console compatibilities.

```typescript
import { Tree, visitNotIgnoredFiles } from '@nrwl/devkit';
import { applyTransform } from 'jscodeshift/src/testUtils';
import arrowFunctionsTransform from './arrow-functions';

// The schema path can be an individual file or a directory
export default async function (tree: Tree, schema: { path: string }): any {
  visitNotIgnoredFiles(tree, schema.path, (filePath) => {
    const input = tree.read(filePath).toString();
    const transformOptions = {};
    const output = applyTransform(
      { default: arrowFunctionsTransform, parser: 'ts' },
      transformOptions,
      { source: input, path: filePath }
    );
    tree.write(filePath, output);
  });
}
```
