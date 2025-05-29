# Function: ensurePackage

▸ **ensurePackage**(`tree`, `pkg`, `requiredVersion`, `options?`): `void`

#### Parameters

| Name                      | Type                                                | Description                                                        |
| :------------------------ | :-------------------------------------------------- | :----------------------------------------------------------------- |
| `tree`                    | [`Tree`](/reference/core-api/devkit/documents/Tree) | the file system tree                                               |
| `pkg`                     | `string`                                            | the package to check (e.g. @nx/jest)                               |
| `requiredVersion`         | `string`                                            | the version or semver range to check (e.g. ~1.0.0, >=1.0.0 <2.0.0) |
| `options?`                | `Object`                                            | -                                                                  |
| `options.dev?`            | `boolean`                                           | -                                                                  |
| `options.throwOnMissing?` | `boolean`                                           | -                                                                  |

#### Returns

`void`

**`Deprecated`**

Use the other function signature without a Tree

Use a package that has not been installed as a dependency.

For example:

```typescript
ensurePackage(tree, '@nx/jest', nxVersion);
```

This install the @nx/jest@<nxVersion> and return the module
When running with --dryRun, the function will throw when dependencies are missing.
Returns null for ESM dependencies. Import them with a dynamic import instead.

▸ **ensurePackage**\<`T`\>(`pkg`, `version`): `T`

Ensure that dependencies and devDependencies from package.json are installed at the required versions.
Returns null for ESM dependencies. Import them with a dynamic import instead.

For example:

```typescript
ensurePackage('@nx/jest', nxVersion);
```

#### Type parameters

| Name | Type                      |
| :--- | :------------------------ |
| `T`  | extends `unknown` = `any` |

#### Parameters

| Name      | Type     | Description                                                 |
| :-------- | :------- | :---------------------------------------------------------- |
| `pkg`     | `string` | the package to install and require                          |
| `version` | `string` | the version to install if the package doesn't exist already |

#### Returns

`T`
