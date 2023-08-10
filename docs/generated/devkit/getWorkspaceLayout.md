# Function: getWorkspaceLayout

▸ **getWorkspaceLayout**(`tree`): `Object`

Returns workspace defaults. It includes defaults folders for apps and libs,
and the default scope.

Example:

```typescript
{ appsDir: 'apps', libsDir: 'libs', npmScope: 'myorg' }
```

#### Parameters

| Name   | Type                                  | Description      |
| :----- | :------------------------------------ | :--------------- |
| `tree` | [`Tree`](../../devkit/documents/Tree) | file system tree |

#### Returns

`Object`

| Name                  | Type      | Description                                                              |
| :-------------------- | :-------- | :----------------------------------------------------------------------- |
| `appsDir`             | `string`  | -                                                                        |
| `libsDir`             | `string`  | -                                                                        |
| `npmScope`            | `string`  | **`Deprecated`** This will be removed in Nx 17. Use getNpmScope instead. |
| `standaloneAsDefault` | `boolean` | -                                                                        |
