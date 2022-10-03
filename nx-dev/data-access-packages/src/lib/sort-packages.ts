export function sortCorePackagesFirst<ItemType extends { id: string }>(
  itemList: ItemType[]
): ItemType[] {
  const nxPackageIds = ['nx', 'workspace', 'devkit', 'nx-plugin'];
  return [
    ...nxPackageIds.map((id) => itemList.find((item) => item.id === id)),
    ...itemList.filter((item) => !nxPackageIds.includes(item.id)),
  ].filter((item): item is ItemType => !!item);
}
