import { RelatedDocument } from './documents.models';

interface RelatedDocumentsCategory {
  id: string;
  name: string;
  matchers: string[];
  relatedDocuments: RelatedDocument[];
}
export function categorizeRelatedDocuments(
  items: RelatedDocument[]
): RelatedDocumentsCategory[] {
  const categories: RelatedDocumentsCategory[] = [
    {
      id: 'concepts',
      name: 'Concepts',
      matchers: ['concepts', 'more-concepts'],
      relatedDocuments: [],
    },
    {
      id: 'recipes',
      name: 'Recipes',
      matchers: ['recipes'],
      relatedDocuments: [],
    },
    {
      id: 'reference',
      name: 'Reference',
      matchers: ['nx', 'workspace'],
      relatedDocuments: [],
    },
    {
      id: 'see-also',
      name: 'See also',
      matchers: ['see-also'],
      relatedDocuments: [],
    },
  ];

  items.forEach((i) =>
    categories.forEach((c) => {
      if (c.matchers.some((m) => i.path.includes(m)))
        c.relatedDocuments.push(i);
    })
  );

  return categories.filter((c) => !!c.relatedDocuments.length);
}

export function generateRelatedDocumentsTemplate(
  relatedDocumentCategories: RelatedDocumentsCategory[]
): string {
  if (!relatedDocumentCategories.length) return '';

  const template = relatedDocumentCategories.map((c) => {
    const header = `### ${c.name}`;
    const template = c.relatedDocuments
      .map((d) => `- [${d.name}](${d.path})`)
      .join('\n');
    return [header, template].join('\n');
  });

  return ['\n## Related Documentation\n', ...template].join('\n');
}
