# Function: getDependencyVersionFromPackageJson

▸ **getDependencyVersionFromPackageJson**(`tree`, `packageName`, `packageJsonPath?`, `dependencyLookup?`): `string` \| `null`

Get the resolved version of a dependency from package.json.

Retrieves a package version and automatically resolves PNPM catalog references
(e.g., "catalog:default") to their actual version strings. By default, searches
`dependencies` first, then falls back to `devDependencies`.

**Tree-based usage** (generators and migrations):
Use when you have a `Tree` object, which is typical in Nx generators and migrations.

**Filesystem-based usage** (CLI commands and scripts):
Use when reading directly from the filesystem without a `Tree` object.

#### Parameters

| Name                | Type                                                | Description                                                                                     |
| :------------------ | :-------------------------------------------------- | :---------------------------------------------------------------------------------------------- |
| `tree`              | [`Tree`](/reference/core-api/devkit/documents/Tree) | -                                                                                               |
| `packageName`       | `string`                                            | -                                                                                               |
| `packageJsonPath?`  | `string`                                            | -                                                                                               |
| `dependencyLookup?` | `PackageJsonDependencySection`[]                    | Array of dependency sections to check in order. Defaults to ['dependencies', 'devDependencies'] |

#### Returns

`string` \| `null`

The resolved version string, or `null` if the package is not found in any of the specified sections

**`Example`**

```typescript
// Tree-based - from root package.json (checks dependencies then devDependencies)
const reactVersion = getDependencyVersionFromPackageJson(tree, 'react');
// Returns: "^18.0.0" (resolves "catalog:default" if present)

// Tree-based - check only dependencies section
const version = getDependencyVersionFromPackageJson(
  tree,
  'react',
  'package.json',
  ['dependencies']
);

// Tree-based - check only devDependencies section
const version = getDependencyVersionFromPackageJson(
  tree,
  'jest',
  'package.json',
  ['devDependencies']
);

// Tree-based - custom lookup order
const version = getDependencyVersionFromPackageJson(
  tree,
  'pkg',
  'package.json',
  ['devDependencies', 'dependencies', 'peerDependencies']
);

// Tree-based - with pre-loaded package.json
const packageJson = readJson(tree, 'package.json');
const version = getDependencyVersionFromPackageJson(
  tree,
  'react',
  packageJson,
  ['dependencies']
);
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

// Filesystem-based - with specific package.json and section
const version = getDependencyVersionFromPackageJson(
  'react',
  '/path/to/workspace',
  'apps/my-app/package.json',
  ['dependencies']
);
```

▸ **getDependencyVersionFromPackageJson**(`tree`, `packageName`, `packageJson?`, `dependencyLookup?`): `string` \| `null`

#### Parameters

| Name                | Type                                                |
| :------------------ | :-------------------------------------------------- |
| `tree`              | [`Tree`](/reference/core-api/devkit/documents/Tree) |
| `packageName`       | `string`                                            |
| `packageJson?`      | `PackageJson`                                       |
| `dependencyLookup?` | `PackageJsonDependencySection`[]                    |

#### Returns

`string` \| `null`

▸ **getDependencyVersionFromPackageJson**(`packageName`, `workspaceRootPath?`, `packageJsonPath?`, `dependencyLookup?`): `string` \| `null`

#### Parameters

| Name                 | Type                             |
| :------------------- | :------------------------------- |
| `packageName`        | `string`                         |
| `workspaceRootPath?` | `string`                         |
| `packageJsonPath?`   | `string`                         |
| `dependencyLookup?`  | `PackageJsonDependencySection`[] |

#### Returns

`string` \| `null`

▸ **getDependencyVersionFromPackageJson**(`packageName`, `workspaceRootPath?`, `packageJson?`, `dependencyLookup?`): `string` \| `null`

#### Parameters

| Name                 | Type                             |
| :------------------- | :------------------------------- |
| `packageName`        | `string`                         |
| `workspaceRootPath?` | `string`                         |
| `packageJson?`       | `PackageJson`                    |
| `dependencyLookup?`  | `PackageJsonDependencySection`[] |

#### Returns

`string` \| `null`
