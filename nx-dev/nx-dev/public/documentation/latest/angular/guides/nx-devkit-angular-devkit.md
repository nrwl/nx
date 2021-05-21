# Nx Devkit and Angular Devkit

> Note: this document covers the difference between Nx Devkit and Angular Devkit. See the [Nx Devkit](/{{framework}}/core-concepts/nx-devkit) guide for more in-depth details about Nx Devkit.

Nx comes with a devkit to write generators and executors, but you can also use Angular devkit (schematics and builders). An Angular schematic is a second way to implement generators. An Angular builder is a second way to implement an executor.

What is the difference between Nx Devkit and Angular Devkit?

## Generators

The following is a generator written using Nx Devkit:

```typescript
import { Tree, formatFiles, generateFiles } from '@nrwl/devkit';
import * as path from 'path';

interface Schema {
  name: string;
  skipFormat: boolean;
}

export default async function (tree: Tree, optoins: Schema) {
  generateFiles(
    tree,
    path.join(__dirname, 'files'),
    path.join('tools/generators', schema.name),
    options
  );
  if (!schema.skipFormat) {
    await formatFiles(tree);
  }
}
```

The following is an analogous generator written as an Angular Schematic.

```typescript
import {
  apply,
  branchAndMerge,
  chain,
  mergeWith,
  Rule,
  template,
  url,
  move,
} from '@angular-devkit/schematics';
import { formatFiles } from '@nrwl/workspace';
import { toFileName } from '@nrwl/workspace';

interface Schema {
  name: string;
  skipFormat: boolean;
}

export default function (options: Schema): Rule {
  const templateSource = apply(url('./files'), [
    template({
      dot: '.',
      tmpl: '',
      ...(options as any),
    }),
    move('tools/generators'),
  ]);
  return chain([
    branchAndMerge(chain([mergeWith(templateSource)])),
    formatFiles(options),
  ]);
}
```

**Some notable changes:**

- Nx Devkit generators do not use partial application. An Angular Schematic returns a rule that is then invoked with a tree.
- Nx Devkit generators do not use RxJS observables. Just invoke the helpers directly. This makes them more debuggable. As you step through the generator you can see the tree being updated.
- `chain([mergeWith(apply(url` is replaced with `generateFiles`)
- Nx Devkit generators return a function that performs side effects. Angular Schematics have to create a custom task runner and register a task using it.
- You don't need any special helpers to compose Nx Devkit generators. You do need to go through a special resolution step to compose Angular Schematics.
- No special utilities are needed to test Nx Devkit generators. Special utilities are needed to test Angular Schematics.

The schema files for both Nx Devkit generators and Angular Schematics are the same. Nx can run both of them in the same way. You can invoke Angular schematics from within Nx Devkit generators using `wrapAngularDevkitSchematic`.

## Executors

The following is an executor written using Nx Devkit:

```typescript
interface Schema {
  message: string;
  allCaps: boolean;
}

export default async function (
  options: Schema,
  context: ExecutorContext
): Promise<{ success: true }> {
  if (options.allCaps) {
    console.log(options.message.toUpperCase());
  } else {
    console.log(options.message);
  }
  return { success: true };
}
```

The following is an analogous executor written as an Angular builder:

```typescript
interface Schema {
  message: string;
  allCaps: boolean;
}

export default function (
  options: Schema,
  context: BuilderContext
): Observable<{ success: true }> {
  if (options.allCaps) {
    console.log(options.message.toUpperCase());
  } else {
    console.log(options.message);
  }
  return of({ success: true });
}
export default createBuilder<NextBuildBuilderOptions>(run);
```

Some notable changes:

- Nx Devkit executors return a Promise (or async iterable). If you want, you can always convert an observable to a promise or an async iterable. See [Using Rxjs Observables](/{{framework}}/core-concepts/nx-devkit#using-rxjs-observables)
- Nx Devkit executors do not have to be wrapped using `createBuilder`.

The schema files for both Nx Devkit executors and Angular Builders are the same. Nx can run both of them in the same way.

## When to Use What

If you are writing an Nx plugin, use Nx Devkit. It's **much** easier to use and debug. It has better docs and more people supporting it.

Do you have to rewrite your Nx Plugin if it is written using Angular Devkit? No. Nx supports both and will always support both. And, most importantly, the end user might not even know what you used to write a generator or an executor.
