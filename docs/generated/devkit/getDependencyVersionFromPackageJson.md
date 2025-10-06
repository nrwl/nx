# Function: getDependencyVersionFromPackageJson

▸ **getDependencyVersionFromPackageJson**(`tree`, `packageName`, `packageJsonPath?`): `string` \| `null`

Get the resolved version of a dependency from package.json.

Retrieves a package version and automatically resolves PNPM catalog references
(e.g., "catalog:default") to their actual version strings. Searches `dependencies`
first, then falls back to `devDependencies`.

**Tree-based usage** (generators and migrations):
Use when you have a `Tree` object, which is typical in Nx generators and migrations.

**Filesystem-based usage** (CLI commands and scripts):
Use when reading directly from the filesystem without a `Tree` object.

#### Parameters

| Name               | Type                                                |
| :----------------- | :-------------------------------------------------- |
| `tree`             | [`Tree`](/reference/core-api/devkit/documents/Tree) |
| `packageName`      | `string`                                            |
| `packageJsonPath?` | `string`                                            |

#### Returns

`string` \| `null`

The resolved version string, or `null` if the package is not found in either dependencies or devDependencies

**`Example`**

```typescript
// Tree-based - from root package.json
const reactVersion = getDependencyVersionFromPackageJson(tree, 'react');
// Returns: "^18.0.0" (resolves "catalog:default" if present)

// Tree-based - from specific package.json
const version = getDependencyVersionFromPackageJson(
  tree,
  '@my/lib',
  'packages/my-lib/package.json'
);

// Tree-based - with pre-loaded package.json
const packageJson = readJson(tree, 'package.json');
const version = getDependencyVersionFromPackageJson(tree, 'react', packageJson);
```

**`Example`**

```typescript
// Filesystem-based - from current directory
const reactVersion = getDependencyVersionFromPackageJson('react');

// Filesystem-based - with workspace root
const version = getDependencyVersionFromPackageJson(
  'react',
  '/path/to/workspace'
);

// Filesystem-based - with specific package.json
const version = getDependencyVersionFromPackageJson(
  'react',
  '/path/to/workspace',
  'apps/my-app/package.json'
);
```

▸ **getDependencyVersionFromPackageJson**(`tree`, `packageName`, `packageJson?`): `string` \| `null`

#### Parameters

| Name           | Type                                                |
| :------------- | :-------------------------------------------------- |
| `tree`         | [`Tree`](/reference/core-api/devkit/documents/Tree) |
| `packageName`  | `string`                                            |
| `packageJson?` | `PackageJson`                                       |

#### Returns

`string` \| `null`

▸ **getDependencyVersionFromPackageJson**(`packageName`, `workspaceRootPath?`, `packageJsonPath?`): `string` \| `null`

#### Parameters

| Name                 | Type     |
| :------------------- | :------- |
| `packageName`        | `string` |
| `workspaceRootPath?` | `string` |
| `packageJsonPath?`   | `string` |

#### Returns

`string` \| `null`

▸ **getDependencyVersionFromPackageJson**(`packageName`, `workspaceRootPath?`, `packageJson?`): `string` \| `null`

#### Parameters

| Name                 | Type          |
| :------------------- | :------------ |
| `packageName`        | `string`      |
| `workspaceRootPath?` | `string`      |
| `packageJson?`       | `PackageJson` |

#### Returns

`string` \| `null`
