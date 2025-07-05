# Function: addDependenciesToPackageJson

▸ **addDependenciesToPackageJson**(`tree`, `dependencies`, `devDependencies`, `packageJsonPath?`, `keepExistingVersions?`): [`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)

Add Dependencies and Dev Dependencies to package.json

For example:

```typescript
addDependenciesToPackageJson(tree, { react: 'latest' }, { jest: 'latest' });
```

This will **add** `react` and `jest` to the dependencies and devDependencies sections of package.json respectively.

#### Parameters

| Name                    | Type                                                | Default value    | Description                                                                 |
| :---------------------- | :-------------------------------------------------- | :--------------- | :-------------------------------------------------------------------------- |
| `tree`                  | [`Tree`](/reference/core-api/devkit/documents/Tree) | `undefined`      | Tree representing file system to modify                                     |
| `dependencies`          | `Record`\<`string`, `string`\>                      | `undefined`      | Dependencies to be added to the dependencies section of package.json        |
| `devDependencies`       | `Record`\<`string`, `string`\>                      | `undefined`      | Dependencies to be added to the devDependencies section of package.json     |
| `packageJsonPath`       | `string`                                            | `'package.json'` | Path to package.json                                                        |
| `keepExistingVersions?` | `boolean`                                           | `undefined`      | If true, prevents existing dependencies from being bumped to newer versions |

#### Returns

[`GeneratorCallback`](/reference/core-api/devkit/documents/GeneratorCallback)

Callback to install dependencies only if necessary, no-op otherwise
