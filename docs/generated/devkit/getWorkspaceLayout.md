# Function: getWorkspaceLayout

▸ **getWorkspaceLayout**(`tree`): `Object`

Returns workspace defaults. It includes defaults folders for apps and libs,
and the default scope.

Example:

```typescript
{ appsDir: 'apps', libsDir: 'libs' }
```

#### Parameters

| Name   | Type                                                | Description      |
| :----- | :-------------------------------------------------- | :--------------- |
| `tree` | [`Tree`](/reference/core-api/devkit/documents/Tree) | file system tree |

#### Returns

`Object`

| Name                  | Type      |
| :-------------------- | :-------- |
| `appsDir`             | `string`  |
| `libsDir`             | `string`  |
| `standaloneAsDefault` | `boolean` |

**`Deprecated`**

Generators should accept the full path via a --directory argument.
