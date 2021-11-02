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

## Using Angular Devkit Schematics

If you need to use a generator written with the Angular devkit (also known as a schematic) inside of an Nx devkit generator, you need to wrap the schematic inside the `wrapAngularDevkitSchematic` function.

Note: All Nrwl maintained schematics have been migrated over to the Nx Devkit, so this should only be necessary for third party schematics.

```typescript
import { wrapAngularDevkitSchematic } from '@nrwl/devkit/ngcli-adapter';

export default async function (tree: Tree, schema: any) {
  const libraryGenerator = wrapAngularDevkitSchematic(
    '@nrwl/angular', // plugin name
    'lib' // schematic name
  );
  await libraryGenerator(
    tree, // virtual file system tree
    { name: schema.name } // options for the generator
  );
}
```
