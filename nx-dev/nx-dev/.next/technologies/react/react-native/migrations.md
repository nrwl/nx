For an overview of the plugin and setup instructions, see the [@nx/react-native introduction](/docs/technologies/react/react-native/introduction).

The @nx/react-native plugin provides various migrations to help you migrate to newer versions of react-native projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/react-native/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/react-native` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/react-native/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/react-native/plugin';
```

##### After

```ts
import { createNodes } from '@nx/react-native/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/react-native/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.0-package-updates
**Version**: 23.0.0-beta.25


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `react-native` | `~0.84.1` | Updated only
| `@react-native-community/cli` | `~20.1.0` | Added if not installed
| `@react-native-community/cli-platform-android` | `~20.1.0` | Added if not installed
| `@react-native-community/cli-platform-ios` | `~20.1.0` | Added if not installed
| `@react-native/babel-preset` | `~0.84.1` | Updated only
| `@react-native/metro-config` | `~0.84.1` | Updated only
| `react-native-web` | `~0.21.0` | Updated only
| `react` | `^19.2.0` | Updated only
| `react-dom` | `^19.2.0` | Updated only
| `react-test-renderer` | `^19.2.0` | Updated only
| `@types/react` | `^19.2.0` | Updated only
| `@types/react-dom` | `^19.2.0` | Updated only
| `@testing-library/react-native` | `~13.2.0` | Updated only
| `react-native-svg-transformer` | `~1.5.1` | Updated only
| `react-native-svg` | `~15.15.0` | Updated only
| `react-native-svg-web` | `~1.0.9` | Updated only
| `@babel/runtime` | `~7.27.6` | Updated only



## 21.4.x

### `update-21-4-0-remove-deprecated-deps`
**Version**: 21.4.0-beta.0

Remove deprecated dependencies from package.json

#### Requires

| Name | Version |
|------|---------|
 `react-native` | `>=0.76.0 <0.79.0` |

### `update-21-4-0-upgrade-react-native-projects`
**Version**: 21.4.0-beta.0

Run nx upgrade for each React Native project


### 21.4.0-package-updates
**Version**: 21.4.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `react-native` | `~0.79.3` | Updated only
| `@react-native-community/cli` | `~18.0.0` | Added if not installed
| `@react-native-community/cli-platform-android` | `~18.0.0` | Added if not installed
| `@react-native-community/cli-platform-ios` | `~18.0.0` | Added if not installed
| `@react-native/babel-preset` | `~0.79.3` | Updated only
| `@react-native/metro-config` | `~0.79.3` | Updated only
| `react-native-web` | `~0.20.0` | Updated only
| `react` | `19.0.0` | Updated only
| `react-dom` | `19.0.0` | Updated only
| `react-test-renderer` | `~19.0.0` | Updated only
| `@types/react` | `~19.0.10` | Updated only
| `@types/react-dom` | `~19.0.6` | Updated only
| `@testing-library/react-native` | `~13.2.0` | Updated only
| `react-native-svg-transformer` | `~1.5.1` | Updated only
| `react-native-svg` | `~15.11.2` | Updated only
| `react-native-svg-web` | `~1.0.9` | Updated only
| `@babel/runtime` | `~7.27.6` | Updated only


