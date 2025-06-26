# Function: removeDependenciesFromPackageJson

▸ **removeDependenciesFromPackageJson**(`tree`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)

Remove Dependencies and Dev Dependencies from package.json

For example:

```typescript
removeDependenciesFromPackageJson(tree, ['react'], ['jest']);
```

This will **remove** `react` and `jest` from the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name              | Type                                                | Default value    | Description                                                                 |
| :---------------- | :-------------------------------------------------- | :--------------- | :-------------------------------------------------------------------------- |
| `tree`            | [`Tree`](/reference/core-api/devkit/documents/Tree) | `undefined`      | -                                                                           |
| `dependencies`    | `string`[]                                          | `undefined`      | Dependencies to be removed from the dependencies section of package.json    |
| `devDependencies` | `string`[]                                          | `undefined`      | Dependencies to be removed from the devDependencies section of package.json |
| `packageJsonPath` | `string`                                            | `'package.json'` | -                                                                           |

#### Returns

[`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)

Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.
