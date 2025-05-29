# Function: removeDependenciesFromPackageJson

▸ **removeDependenciesFromPackageJson**(`tree`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)

Remove Dependencies and Dev Dependencies from package.json

For example:

```typescript
removeDependenciesFromPackageJson(tree, ['react'], ['jest']);
```

This will **remove** `react` and `jest` from the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name               | Type                                                | Description                                                                 |
| :----------------- | :-------------------------------------------------- | :-------------------------------------------------------------------------- |
| `tree`             | [`Tree`](/reference/core-api/devkit/documents/Tree) | -                                                                           |
| `dependencies`     | `string`[]                                          | Dependencies to be removed from the dependencies section of package.json    |
| `devDependencies`  | `string`[]                                          | Dependencies to be removed from the devDependencies section of package.json |
| `packageJsonPath?` | `string`                                            | -                                                                           |

#### Returns

[`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)

Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.
