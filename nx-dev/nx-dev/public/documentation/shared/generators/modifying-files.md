# Modifying Files with a Generator

Modifying existing files is an order of magnitude harder than creating new files, so care should be taken when trying to automate this process. When the situation merits it, automating a process can lead to tremendous benefits across the organization. Here are some approaches listed from simplest to most complex.

## Compose Existing Generators

If you can compose together existing generators to modify the files you need, you should take that approach. See [Composing Generators](./composing-generators) for more information.

## Modify JSON Files

JSON files are fairly simple to modify, given their predictable structure.

The following example adds a `package.json` script that issues a friendly greeting.

```typescript
import { updateJson } from '@nrwl/devkit';

export default async function (tree: Tree, schema: any) {
  updateJson(tree, 'package.json', (pkgJson) => {
    // if scripts is undefined, set it to an empty object
    pkgJson.scripts = pkgJson.scripts ?? {};
    // add greet script
    pkgJson.scripts.greet = 'echo "Hello!"';
    // return modified JSON object
    return pkgJson;
  });
}
```

## String Replace

For files that are not as predictable as JSON files (like `.ts`, `.md` or `.css` files), modifying the contents can get tricky. One approach is to do a find and replace on the string contents of the file.

Let's say we want to replace any instance of `thomasEdison` with `nikolaTesla` in the `index.ts` file.

```typescript
export default async function (tree: Tree, schema: any) {
  const filePath = `path/to/index.ts`;
  const contents = tree.read(filePath);
  contents.replace('thomasEdison', 'nikolaTesla');
  tree.write(filePath, contents);
}
```

This works, but only replaces the first instance of `thomasEdison`. To replace them all, you need to use regular expressions. (Regular expressions also give you a lot more flexibility in how you search for a string.)

```typescript
export default async function (tree: Tree, schema: any) {
  const filePath = `path/to/index.ts`;
  const contents = tree.read(filePath);
  contents.replace(/thomasEdison/g, 'nikolaTesla');
  tree.write(filePath, contents);
}
```

## AST Manipulation

ASTs (Abstract Syntax Trees) allow you to understand exactly the code you're modifying. Replacing a string value can accidentally modify text found in a comment rather than changing the name of a variable.

We'll write a generator that replaces all instances of the type `Array<something>` with `something[]`. To help accomplish this, we'll use the `@phenomnomnominal/tsquery` npm package and the [AST Explorer](https://astexplorer.net) site. TSQuery allows you to query and modify ASTs with a syntax similar to CSS selectors. The AST Explorer tool allows you to easily examine the AST for a given snippet of code.

First, go to [AST Explorer](https://astexplorer.net) and paste in a snippet of code that contains the input and desired output of our generator.

```typescript
// input
const arr: Array<string> = [];

// desired output
const arr: string[] = [];
```

Make sure the parser is set to `typescript`. When you place the cursor on the `Array` text, the right hand panel highlights the corresponding node of the AST. The AST node we're looking for looks like this:

```typescript
{ // TypeReference
  typeName: { // Identifier
    escapedText: "Array"
  },
  typeArguments: [/* this is where the generic type parameter is specified */]
}
```

Second, we need to choose a selector to target this node. Just like with CSS selectors, there is an art to choosing a selector that is specific enough to target the correct nodes, but not overly tied to a certain structure. For our simple example, we can use `TypeReference` to select the parent node and check to see if it has a `typeName` of `Array` before we perform the replacement. We'll then use the `typeArguments` to get the text inside the `<>` characters.

The finished code looks like this:

```typescript
import { readProjectConfiguration, Tree } from '@nrwl/devkit';
import { tsquery } from '@phenomnomnominal/tsquery';
import { TypeReferenceNode } from 'typescript';

/**
 * Run the callback on all files inside the specified path
 */
function visitAllFiles(
  tree: Tree,
  path: string,
  callback: (filePath: string) => void
) {
  tree.children(path).forEach((fileName) => {
    const filePath = `${path}/${fileName}`;
    if (!tree.isFile(filePath)) {
      visitAllFiles(tree, filePath, callback);
    } else {
      callback(filePath);
    }
  });
}

export default function (tree: Tree, schema: any) {
  const sourceRoot = readProjectConfiguration(tree, schema.name).sourceRoot;
  visitAllFiles(tree, sourceRoot, (filePath) => {
    const fileEntry = tree.read(filePath);
    const contents = fileEntry.toString();

    // Check each `TypeReference` node to see if we need to replace it
    const newContents = tsquery.replace(contents, 'TypeReference', (node) => {
      const trNode = node as TypeReferenceNode;
      if (trNode.typeName.getText() === 'Array') {
        const typeArgument = trNode.typeArguments[0];
        return `${typeArgument.getText()}[]`;
      }
      // return undefined does not replace anything
    });

    // only write the file if something has changed
    if (newContents !== contents) {
      tree.write(filePath, newContents);
    }
  });
}
```
