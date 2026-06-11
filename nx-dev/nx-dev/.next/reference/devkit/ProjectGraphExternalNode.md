A node describing an external dependency
`name` has as form of:
- `npm:packageName` for root dependencies or
- `npm:packageName@version` for nested transitive dependencies

This is vital for our node discovery to always point to root dependencies,
while allowing tracking of the full tree of different nested versions

## Table of contents

### Properties

- [data](/docs/reference/devkit/ProjectGraphExternalNode#data)
- [name](/docs/reference/devkit/ProjectGraphExternalNode#name)
- [type](/docs/reference/devkit/ProjectGraphExternalNode#type)

## Properties

### data

• **data**: `Object`

#### Type declaration

| Name | Type |
| :------ | :------ |
| `hash?` | `string` |
| `packageName` | `string` |
| `version` | `string` |

___

### name

• **name**: `string`

___

### type

• **type**: `string`
