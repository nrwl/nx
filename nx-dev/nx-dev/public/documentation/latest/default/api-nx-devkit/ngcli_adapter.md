# Module: ngcli-adapter

## Table of contents

### Ng CLI Adapter Classes

- [NxScopedHost](../../default/nx-devkit/ngcli_adapter#nxscopedhost)

### Functions

- [mockSchematicsForTesting](../../default/nx-devkit/ngcli_adapter#mockschematicsfortesting)
- [overrideCollectionResolutionForTesting](../../default/nx-devkit/ngcli_adapter#overridecollectionresolutionfortesting)
- [wrapAngularDevkitSchematic](../../default/nx-devkit/ngcli_adapter#wrapangulardevkitschematic)

## Ng CLI Adapter Classes

### NxScopedHost

• **NxScopedHost**: `Object`

## Functions

### mockSchematicsForTesting

▸ **mockSchematicsForTesting**(`schematics`): `void`

If you have an Nx Devkit generator invoking the wrapped Angular Devkit schematic,
and you don't want the Angular Devkit schematic to run, you can mock it up using this function.

Unfortunately, there are some edge cases in the Nx-Angular devkit integration that
can be seen in the unit tests context. This function is useful for handling that as well.

In this case, you can mock it up.

Example:

```typescript
mockSchematicsForTesting({
  'mycollection:myschematic': (tree, params) => {
    tree.write('README.md');
  },
});
```

#### Parameters

| Name         | Type     |
| :----------- | :------- |
| `schematics` | `Object` |

#### Returns

`void`

---

### overrideCollectionResolutionForTesting

▸ **overrideCollectionResolutionForTesting**(`collections`): `void`

By default, Angular Devkit schematic collections will be resolved using the Node resolution.
This doesn't work if you are testing schematics that refer to other schematics in the
same repo.

This function can can be used to override the resolution behaviour.

Example:

```typescript
overrideCollectionResolutionForTesting({
  '@nrwl/workspace': path.join(
    __dirname,
    '../../../../workspace/generators.json'
  ),
  '@nrwl/angular': path.join(__dirname, '../../../../angular/generators.json'),
  '@nrwl/linter': path.join(__dirname, '../../../../linter/generators.json'),
});
```

#### Parameters

| Name          | Type     |
| :------------ | :------- |
| `collections` | `Object` |

#### Returns

`void`

---

### wrapAngularDevkitSchematic

▸ **wrapAngularDevkitSchematic**(`collectionName`, `generatorName`): (`host`: [`Tree`](../../default/nx-devkit/index#tree), `generatorOptions`: { [k: string]: `any`; }) => `Promise`<`any`\>

#### Parameters

| Name             | Type     |
| :--------------- | :------- |
| `collectionName` | `string` |
| `generatorName`  | `string` |

#### Returns

`fn`

▸ (`host`, `generatorOptions`): `Promise`<`any`\>

##### Parameters

| Name               | Type                                         |
| :----------------- | :------------------------------------------- |
| `host`             | [`Tree`](../../default/nx-devkit/index#tree) |
| `generatorOptions` | `Object`                                     |

##### Returns

`Promise`<`any`\>
