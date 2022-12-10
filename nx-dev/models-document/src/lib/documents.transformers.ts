import { DocumentMetadata } from './documents.models';

export function createDocumentMetadata(
  defaults: Partial<DocumentMetadata> = {}
): DocumentMetadata {
  if (!defaults.id) throw new Error('A document entry requires an "id".');

  return Object.assign(
    {},
    {
      id: 'fake-id',
      name: '',
      description: '',
      file: '',
      itemList: [],
      isExternal: false,
      packageName: '',
      path: '',
      tags: [],
    },
    defaults
  );
}

export function convertToDocumentMetadata(
  target: Partial<DocumentMetadata>
): DocumentMetadata {
  if (!target.id) throw new Error('A document entry requires an "id".');

  if (target.itemList)
    target.itemList.map((item) => convertToDocumentMetadata(item));

  return {
    id: target.id,
    name: target.name ?? '',
    description: target.description ?? '',
    file: target.file ?? '',
    itemList: target.itemList ?? [],
    isExternal: target.isExternal ?? false,
    packageName: target.packageName ?? '',
    path: target.path ?? '',
    tags: target.tags ?? [],
  };
}
