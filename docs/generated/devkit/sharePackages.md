# Function: sharePackages

▸ **sharePackages**(`packages`): `Record`<`string`, [`SharedLibraryConfig`](../../devkit/documents/SharedLibraryConfig)\>

Create a dictionary of packages and their Module Federation Shared Config
from an array of package names.

Lookup the versions of the packages from the root package.json file in the
workspace.

#### Parameters

| Name       | Type       | Description                       |
| :--------- | :--------- | :-------------------------------- |
| `packages` | `string`[] | Array of package names as strings |

#### Returns

`Record`<`string`, [`SharedLibraryConfig`](../../devkit/documents/SharedLibraryConfig)\>
