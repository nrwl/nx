# Function: overrideCollectionResolutionForTesting

▸ **overrideCollectionResolutionForTesting**(`collections`): `void`

By default, Angular Devkit schematic collections will be resolved using the Node resolution.
This doesn't work if you are testing schematics that refer to other schematics in the
same repo.

This function can can be used to override the resolution behaviour.

Example:

```typescript
overrideCollectionResolutionForTesting({
  '@nx/workspace': path.join(
    __dirname,
    '../../../../workspace/generators.json'
  ),
  '@nx/angular': path.join(__dirname, '../../../../angular/generators.json'),
  '@nx/linter': path.join(__dirname, '../../../../linter/generators.json'),
});
```

#### Parameters

| Name          | Type     |
| :------------ | :------- |
| `collections` | `Object` |

#### Returns

`void`
