For an overview of the plugin and setup instructions, see the [@nx/expo introduction](/docs/technologies/react/expo/introduction).

The @nx/expo plugin provides various migrations to help you migrate to newer versions of expo projects within your Nx workspace.
Below is a complete reference for all available migrations.

## 23.1.x

### `update-23-1-0-update-metro-config-for-expo-56`
**Version**: 23.1.0-beta.1

Update generated metro.config.js to use @expo/metro for Expo SDK 56

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 56.0.0` |

### `update-23-1-0-replace-standalone-metro-for-expo-56`
**Version**: 23.1.0-beta.1

Replace standalone metro-config/metro-resolver with @expo/metro for Expo SDK 56

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 56.0.0` |

### `update-23-1-0-update-jest-winter-runtime-for-expo-56`
**Version**: 23.1.0-beta.1

Update Jest test-setup for the Expo SDK 56 winter runtime

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 56.0.0` |

### 23.1.0-package-updates
**Version**: 23.1.0-beta.1


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `expo` | `~56.0.0` | Updated only
| `expo-splash-screen` | `~56.0.10` | Updated only
| `expo-status-bar` | `~56.0.4` | Updated only
| `expo-system-ui` | `~56.0.5` | Updated only
| `@expo/cli` | `~56.1.14` | Updated only
| `babel-preset-expo` | `~56.0.14` | Updated only
| `react` | `^19.2.0` | Updated only
| `react-dom` | `^19.2.0` | Updated only
| `@types/react` | `^19.2.0` | Updated only
| `react-native` | `0.85.3` | Updated only
| `react-native-web` | `~0.21.0` | Updated only
| `@expo/metro` | `~56.0.0` | Updated only
| `@expo/metro-config` | `~56.0.13` | Updated only
| `@expo/metro-runtime` | `~56.0.14` | Updated only
| `@expo/vector-icons` | `~15.1.0` | Updated only
| `react-native-svg-transformer` | `~1.5.1` | Updated only
| `react-native-svg` | `15.12.1` | Updated only
| `@testing-library/react-native` | `~13.2.0` | Updated only
| `jest-expo` | `~56.0.4` | Updated only
| `@babel/runtime` | `~7.27.6` | Updated only



## 23.0.x

### `update-23-0-0-migrate-create-nodes-v2-import`
**Version**: 23.0.0-beta.24

Rename imports of `createNodesV2` from `@nx/expo/plugin` to the canonical `createNodes` export.

#### Rename `createNodesV2` imports to `createNodes`

`@nx/expo` renamed its primary inferred-plugin export from `createNodesV2` to `createNodes`. The `createNodesV2` name is preserved as a deprecated alias for now, but new code should use `createNodes`.

This migration scans every `.ts`, `.tsx`, `.cts`, and `.mts` file in your workspace and rewrites named imports and re-exports of `createNodesV2` from `@nx/expo/plugin` to `createNodes`.

#### Sample Code Changes

##### Before

```ts
import { createNodesV2 } from '@nx/expo/plugin';
```

##### After

```ts
import { createNodes } from '@nx/expo/plugin';
```

Aliases are preserved (`createNodesV2 as cn` becomes `createNodes as cn`), and if a file already imports both names (`{ createNodes, createNodesV2 }`) the redundant binding is dropped.

#### What is not rewritten

Only static `import`/`export` named bindings from `@nx/expo/plugin` are rewritten. Namespace imports, dynamic `import(...)`, `require(...)` destructuring, and property access such as `plugin.createNodesV2` are left untouched — they keep working through the `createNodesV2` runtime alias. Update those by hand if you want to drop the deprecated name everywhere.



### 23.0.0-package-updates
**Version**: 23.0.0-beta.25


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `expo` | `~55.0.26` | Updated only
| `expo-splash-screen` | `~55.0.21` | Updated only
| `expo-status-bar` | `~55.0.6` | Updated only
| `expo-system-ui` | `~55.0.18` | Updated only
| `@expo/cli` | `~55.0.11` | Updated only
| `babel-preset-expo` | `~55.0.7` | Updated only
| `react` | `^19.2.0` | Updated only
| `react-dom` | `^19.2.0` | Updated only
| `@types/react` | `^19.2.0` | Updated only
| `react-native` | `~0.83.6` | Updated only
| `react-native-web` | `~0.21.0` | Updated only
| `@expo/metro-config` | `~55.0.8` | Updated only
| `@expo/metro-runtime` | `~55.0.11` | Updated only
| `react-native-svg-transformer` | `~1.5.1` | Updated only
| `react-native-svg` | `15.12.1` | Updated only
| `@testing-library/react-native` | `~13.2.0` | Updated only
| `jest-expo` | `~55.0.18` | Updated only
| `@babel/runtime` | `~7.27.6` | Updated only
| `metro-config` | `~0.83.0` | Updated only
| `metro-resolver` | `~0.83.0` | Updated only



## 22.2.x

### `update-22-2-0-create-ai-instructions-for-expo-54`
**Version**: 22.2.0-beta.3

Create AI migration instructions for Expo SDK 54 upgrade


### `update-22-2-0-add-expo-system-ui`
**Version**: 22.2.0-beta.3

Add expo-system-ui dependency for Expo SDK 54

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 54.0.0` |

### `update-22-2-0-update-jest-for-expo-54`
**Version**: 22.2.0-beta.3

Update Jest configuration for Expo SDK 54

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 54.0.0` |

### 22.2.0-package-updates
**Version**: 22.2.0-beta.3


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `expo` | `~54.0.0` | Updated only
| `expo-splash-screen` | `~31.0.11` | Updated only
| `expo-status-bar` | `~3.0.8` | Updated only
| `expo-system-ui` | `~6.0.8` | Updated only
| `@expo/cli` | `~54.0.16` | Updated only
| `babel-preset-expo` | `~54.0.7` | Updated only
| `react` | `^19.1.0` | Updated only
| `react-dom` | `^19.1.0` | Updated only
| `@types/react` | `^19.1.0` | Updated only
| `react-native` | `~0.81.5` | Updated only
| `react-native-web` | `~0.21.0` | Updated only
| `@expo/metro-config` | `~54.0.9` | Updated only
| `@expo/metro-runtime` | `~6.1.2` | Updated only
| `react-native-svg-transformer` | `~1.5.1` | Updated only
| `react-native-svg` | `15.12.1` | Updated only
| `@testing-library/react-native` | `~13.2.0` | Updated only
| `jest-expo` | `~54.0.13` | Updated only
| `@babel/runtime` | `~7.27.6` | Updated only
| `metro-config` | `~0.83.0` | Updated only
| `metro-resolver` | `~0.83.0` | Updated only



## 21.4.x

### `update-21-4-0-remove-deprecated-deps`
**Version**: 21.4.0-beta.0

Remove deprecated dependencies from package.json

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 53.0.0` |

### `update-21-4-0-update-splash-screen-config`
**Version**: 21.4.0-beta.0

Update Expo splash screen configuration to use the new format

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 53.0.0` |

### `update-21-4-0-add-jest-resolver`
**Version**: 21.4.0-beta.0

Add custom Jest resolver to handle Expo winter runtime issues

#### Requires

| Name | Version |
|------|---------|
 `expo` | `>= 53.0.0 < 54.0.0` |

### 21.4.0-package-updates
**Version**: 21.4.0-beta.0


#### Packages

The following packages will be updated:

| Name | Version | Always add to `package.json`
|---------|----------|---------|
| `expo` | `~53.0.10` | Updated only
| `expo-splash-screen` | `~0.30.9` | Updated only
| `expo-status-bar` | `~2.2.3` | Updated only
| `@expo/cli` | `~0.24.14` | Updated only
| `babel-preset-expo` | `~13.2.0` | Updated only
| `react` | `19.0.0` | Updated only
| `react-dom` | `19.0.0` | Updated only
| `@types/react` | `~19.0.10` | Updated only
| `react-native` | `~0.79.3` | Updated only
| `react-native-web` | `~0.20.0` | Updated only
| `@expo/metro-config` | `~0.20.14` | Updated only
| `@expo/metro-runtime` | `~5.0.4` | Updated only
| `react-native-svg-transformer` | `~1.5.1` | Updated only
| `react-native-svg` | `~15.11.2` | Updated only
| `@testing-library/react-native` | `~13.2.0` | Updated only
| `jest-expo` | `~53.0.7` | Updated only
| `@babel/runtime` | `~7.27.6` | Updated only


