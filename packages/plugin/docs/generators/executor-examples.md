## Examples

##### Basic executor

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build.ts
```

##### Without providing the file extension

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build
```

##### With different exported name

Create a new executor called `custom` at `tools/my-plugin/src/executors/build.ts`:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build.ts --name=custom
```

##### With custom hashing

Create a new executor called `build` at `tools/my-plugin/src/executors/build.ts`, that uses a custom hashing function:

```bash
nx g @nx/plugin:executor tools/my-plugin/src/executors/build --includeHasher
```
