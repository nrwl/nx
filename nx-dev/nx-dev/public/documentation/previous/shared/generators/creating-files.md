# Creating files with a generator

Generators provide an API for managing files within your workspace. You can use generators to do things such as create, update, move, and delete files. Files with static or dynamic content can also be created.

The generator below shows you how to generate a library, and then scaffold out additional files with the newly created library.

First, you define a folder to store your static or dynamic templates used to generated files. This is commonly done in a `files` folder.

```treeview
happynrwl/
├── apps/
├── libs/
├── tools/
│   ├── generators
│   |   └── my-generator/
│   |   |    └── files
│   |   |        └── NOTES.md
│   |   |    ├── index.ts
│   |   |    └── schema.json
├── nx.json
├── package.json
└── tsconfig.base.json
```

The files can use EJS syntax to substitute variables and logic. See the [EJS Docs](https://ejs.co/) to see more information about how to write these template files.

Example NOTES.md:

```markdown
Hello, my name is <%= name %>!
```

Next, update the `index.ts` file for the generator, and generate the new files.

```typescript
import {
  Tree,
  formatFiles,
  installPackagesTask,
  generateFiles,
  joinPathFragments,
  readProjectConfiguration,
} from '@nrwl/devkit';
import { libraryGenerator } from '@nrwl/workspace';

export default async function (tree: Tree, schema: any) {
  await libraryGenerator(tree, { name: schema.name });
  const libraryRoot = readProjectConfiguration(tree, schema.name).root;
  generateFiles(
    tree, // the virtual file system
    joinPathFragments(__dirname, './files'), // path to the file templates
    libraryRoot, // destination path of the files
    schema // config object to replace variable in file templates
  );
  await formatFiles(tree);
  return () => {
    installPackagesTask(tree);
  };
}
```

The exported function first creates the library, then creates the additional files in the new library's folder.

Next, run the generator:

> Use the `-d` or `--dry-run` flag to see your changes without applying them.

```bash
nx workspace-generator my-generator mylib
```

The following information will be displayed.

```bash
CREATE libs/mylib/README.md
CREATE libs/mylib/.babelrc
CREATE libs/mylib/src/index.ts
CREATE libs/mylib/src/lib/mylib.spec.ts
CREATE libs/mylib/src/lib/mylib.ts
CREATE libs/mylib/tsconfig.json
CREATE libs/mylib/tsconfig.lib.json
UPDATE tsconfig.base.json
UPDATE workspace.json
UPDATE nx.json
CREATE libs/mylib/.eslintrc.json
CREATE libs/mylib/jest.config.js
CREATE libs/mylib/tsconfig.spec.json
UPDATE jest.config.js
CREATE libs/mylib/NOTES.md
```

`libs/mylib/NOTES.md` will contain the content with substituted variables:

```markdown
Hello, my name is mylib!
```

## Dynamic File Names

If you want the generated file or folder name to contain variable values, use `__variable__`. So `NOTES-for-__name__.md` would be resolved to `NOTES_for_mylib.md` in the above example.

## EJS Syntax Quickstart

The [EJS syntax](https://ejs.co/) can do much more than replace variable names with values. Here are some common techniques.

1. Pass a function into the template:

```typescript
// template file
This is my <%= uppercase(name) %>
```

```typescript
// typescript file
function uppercase(val: string) {
  return val.toUpperCase();
}

// later

generateFiles(tree, joinPathFragments(__dirname, './files'), libraryRoot, {
  uppercase,
  name: schema.name,
});
```

2. Use javascript for control flow in the template:

```typescript
<% if(shortVersion) { %>
This is the short version.
<% } else {
  for(let x=0; x<numRepetitions; x++) {
  %>
  This text will be repeated <%= numRepetitions %> times.
<% } // end for loop
} // end else block %>
```

```typescript
// typescript file
generateFiles(tree, joinPathFragments(__dirname, './files'), libraryRoot, {
  shortVersion: false,
  numRepetitions: 3,
});
```
