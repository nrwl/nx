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

The generator no longer creates custom hashers, and passing `--includeHasher` throws. Custom hashers are deprecated and will be removed in Nx 25. Declare what the executor depends on as target `inputs` instead. See [Replace a custom hasher with inputs](/docs/kb/local-executors#replace-a-custom-hasher-with-inputs).
