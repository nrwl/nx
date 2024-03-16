# Function: mockSchematicsForTesting

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
    tree.write('README');
  },
});
```

#### Parameters

| Name         | Type     |
| :----------- | :------- |
| `schematics` | `Object` |

#### Returns

`void`
