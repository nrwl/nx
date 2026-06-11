▸ **removeDependenciesFromPackageJson**(`tree`, `dependencies`, `devDependencies`, `packageJsonPath?`): [`GeneratorCallback`](/docs/reference/devkit/GeneratorCallback)

Remove Dependencies and Dev Dependencies from package.json

For example:
```typescript
removeDependenciesFromPackageJson(tree, ['react'], ['jest'])
```
This will **remove** `react` and `jest` from the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `tree` | [`Tree`](/docs/reference/devkit/Tree) | - |
| `dependencies` | `string`[] | Dependencies to be removed from the dependencies section of package.json |
| `devDependencies` | `string`[] | Dependencies to be removed from the devDependencies section of package.json |
| `packageJsonPath?` | `string` | - |

#### Returns

[`GeneratorCallback`](/docs/reference/devkit/GeneratorCallback)

Callback to uninstall dependencies only if necessary. undefined is returned if changes are not necessary.
