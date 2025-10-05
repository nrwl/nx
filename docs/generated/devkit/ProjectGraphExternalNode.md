# Interface: ProjectGraphExternalNode

A node describing an external dependency
`name` has as form of:

- `npm:packageName` for root dependencies or
- `npm:packageName@version` for nested transitive dependencies

This is vital for our node discovery to always point to root dependencies,
while allowing tracking of the full tree of different nested versions

## Table of contents

### Properties

- [data](/reference/core-api/devkit/documents/ProjectGraphExternalNode#data): Object
- [name](/reference/core-api/devkit/documents/ProjectGraphExternalNode#name): string
- [type](/reference/core-api/devkit/documents/ProjectGraphExternalNode#type): string

## Properties

### data

• **data**: `Object`

#### Type declaration

| Name          | Type     |
| :------------ | :------- |
| `hash?`       | `string` |
| `packageName` | `string` |
| `version`     | `string` |

---

### name

• **name**: `string`

---

### type

• **type**: `string`
