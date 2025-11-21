#### Sample Code Changes

Add `.nx/cache` to the `.gitignore` file.

##### Before

```text title=".gitignore"
node_modules
```

##### After

```text title=".gitignore" {2}
node_modules
.nx/cache
```

Add `.nx/cache` to the `.prettierignore` file.

##### Before

```ts title=".prettierignore"
/dist
```

##### After

```ts title=".prettierignore" {2}
/dist
.nx/cache
```
