# Function: installPackagesTask

▸ **installPackagesTask**(`tree`, `alwaysRun?`, `cwd?`, `packageManager?`): `void`

Runs `npm install` or `yarn install`. It will skip running the install if
`package.json` hasn't changed at all or it hasn't changed since the last invocation.

#### Parameters

| Name              | Type                                                                    | Description                                                   |
| :---------------- | :---------------------------------------------------------------------- | :------------------------------------------------------------ |
| `tree`            | [`Tree`](/reference/core-api/devkit/documents/Tree)                     | the file system tree                                          |
| `alwaysRun?`      | `boolean`                                                               | always run the command even if `package.json` hasn't changed. |
| `cwd?`            | `string`                                                                | -                                                             |
| `packageManager?` | [`PackageManager`](/reference/core-api/devkit/documents/PackageManager) | -                                                             |

#### Returns

`void`
