▸ **targetToTargetString**(`target`): `string`

Returns a string in the format "project:target[:configuration]" for the target

#### Parameters

| Name | Type | Description |
| :------ | :------ | :------ |
| `target` | [`Target`](/docs/reference/devkit/Target) | target object Examples: ```typescript targetToTargetString({ project: "proj", target: "test" }) // returns "proj:test" targetToTargetString({ project: "proj", target: "test", configuration: "production" }) // returns "proj:test:production" ``` |

#### Returns

`string`
