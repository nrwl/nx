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

  return {
    id: target.id,
    name: target.name ?? '',
    description: target.description ?? '',
    file: target.file ?? '',
    itemList: target.itemList
      ? target.itemList.map((item) => convertToDocumentMetadata(item))
      : [],
    isExternal: target.isExternal ?? false,
    path: target.path ?? '',
    tags: target.tags ?? [],
  };
}
