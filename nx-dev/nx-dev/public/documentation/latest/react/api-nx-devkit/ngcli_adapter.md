# Module: ngcli-adapter

## Table of contents

### Classes

- [NxScopedHost](../../react/nx-devkit/ngcli_adapter#nxscopedhost)

### Functions

- [mockSchematicsForTesting](../../react/nx-devkit/ngcli_adapter#mockschematicsfortesting)
- [overrideCollectionResolutionForTesting](../../react/nx-devkit/ngcli_adapter#overridecollectionresolutionfortesting)
- [wrapAngularDevkitSchematic](../../react/nx-devkit/ngcli_adapter#wrapangulardevkitschematic)

## Classes

### NxScopedHost

• **NxScopedHost**: _object_

## Functions

### mockSchematicsForTesting

▸ **mockSchematicsForTesting**(`schematics`: { [name: string]: (`host`: [_Tree_](../../react/nx-devkit/index#tree), `generatorOptions`: { [k: string]: _any_; }) => _Promise_<void\>; }): _void_

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
| `schematics` | _object_ |

**Returns:** _void_

---

### overrideCollectionResolutionForTesting

▸ **overrideCollectionResolutionForTesting**(`collections`: { [name: string]: _string_; }): _void_

By default, Angular Devkit schematic collections will be resolved using the Node resolution.
This doesn't work if you are testing schematics that refer to other schematics in the
same repo.

This function can can be used to override the resolution behaviour.

Example:

```typescript
overrideCollectionResolutionForTesting({
  '@nrwl/workspace': path.join(
    __dirname,
    '../../../../workspace/collection.json'
  ),
  '@nrwl/angular': path.join(__dirname, '../../../../angular/collection.json'),
  '@nrwl/linter': path.join(__dirname, '../../../../linter/collection.json'),
});
```

#### Parameters

| Name          | Type     |
| :------------ | :------- |
| `collections` | _object_ |

**Returns:** _void_

---

### wrapAngularDevkitSchematic

▸ **wrapAngularDevkitSchematic**(`collectionName`: _string_, `generatorName`: _string_): _function_

#### Parameters

| Name             | Type     |
| :--------------- | :------- |
| `collectionName` | _string_ |
| `generatorName`  | _string_ |

**Returns:** (`host`: [_Tree_](../../react/nx-devkit/index#tree), `generatorOptions`: { [k: string]: _any_; }) => _Promise_<any\>
