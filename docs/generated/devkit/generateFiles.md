# Function: generateFiles

▸ **generateFiles**(`tree`, `srcFolder`, `target`, `substitutions`, `options?`): `void`

Generates a folder of files based on provided templates.

While doing so it performs two substitutions:

- Substitutes segments of file names surrounded by \_\_
- Uses ejs to substitute values in templates

Examples:

```typescript
generateFiles(tree, path.join(__dirname, 'files'), './tools/scripts', {
  tmpl: '',
  name: 'myscript',
});
```

This command will take all the files from the `files` directory next to the place where the command is invoked from.
It will replace all `__tmpl__` with '' and all `__name__` with 'myscript' in the file names, and will replace all
`<%= name %>` with `myscript` in the files themselves.
`tmpl: ''` is a common pattern. With it you can name files like this: `index.ts__tmpl__`, so your editor
doesn't get confused about incorrect TypeScript files.

#### Parameters

| Name            | Type                                  | Description                                   |
| :-------------- | :------------------------------------ | :-------------------------------------------- |
| `tree`          | [`Tree`](../../devkit/documents/Tree) | the file system tree                          |
| `srcFolder`     | `string`                              | the source folder of files (absolute path)    |
| `target`        | `string`                              | the target folder (relative to the tree root) |
| `substitutions` | `Object`                              | an object of key-value pairs                  |
| `options?`      | `GenerateFilesOptions`                | See GenerateFilesOptions                      |

#### Returns

`void`
