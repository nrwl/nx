export function sortCorePackagesFirst<ItemType extends object>(
  itemList: ItemType[],
  ref: PropertyKey
): ItemType[] {
  const nxPackageIds = ['nx', 'workspace', 'devkit', 'nx-plugin'];
  function assertRef(
    value: PropertyKey,
    target: ItemType
  ): value is keyof ItemType {
    if (!(value in target))
      throw new Error(
        `Property '${value.toString()}' can not be found in passed object.`
      );
    return true;
  }
  return [
    ...nxPackageIds.map((s) =>
      itemList.find((item) => assertRef(ref, item) && item[ref] === s)
    ),
    ...itemList.filter(
      (item) =>
        assertRef(ref, item) && !nxPackageIds.includes(String(item[ref]))
    ),
  ].filter((item): item is ItemType => !!item);
}

export function filterMigrationPackages<ItemType extends { name: string }>(
  itemList: ItemType[]
): ItemType[] {
  const nxPackageNames = ['create-nx-workspace', 'create-nx-plugin', 'tao'];
  return itemList.filter(
    (item): item is ItemType => !nxPackageNames.includes(item.name)
  );
}
