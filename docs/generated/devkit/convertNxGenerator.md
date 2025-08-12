# Function: convertNxGenerator

▸ **convertNxGenerator**\<`T`\>(`generator`, `skipWritingConfigInOldFormat?`): (`generatorOptions`: `T`) => (`tree`: `any`, `context`: `any`) => `Promise`\<`any`\>

Convert an Nx Generator into an Angular Devkit Schematic.

#### Type parameters

| Name | Type  |
| :--- | :---- |
| `T`  | `any` |

#### Parameters

| Name                            | Type                                                                 | Description                                                 |
| :------------------------------ | :------------------------------------------------------------------- | :---------------------------------------------------------- |
| `generator`                     | [`Generator`](/reference/core-api/devkit/documents/Generator)\<`T`\> | The Nx generator to convert to an Angular Devkit Schematic. |
| `skipWritingConfigInOldFormat?` | `boolean`                                                            | -                                                           |

#### Returns

`fn`

▸ (`generatorOptions`): (`tree`: `any`, `context`: `any`) => `Promise`\<`any`\>

##### Parameters

| Name               | Type |
| :----------------- | :--- |
| `generatorOptions` | `T`  |

##### Returns

`fn`

▸ (`tree`, `context`): `Promise`\<`any`\>

##### Parameters

| Name      | Type  |
| :-------- | :---- |
| `tree`    | `any` |
| `context` | `any` |

##### Returns

`Promise`\<`any`\>
