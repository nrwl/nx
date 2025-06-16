import { RelatedDocument } from './documents.models';

export interface RelatedDocumentsCategory {
  id: string;
  /**
   * Matcher that will be evaluated against a path.
   */
  matchers: string[];
  name: string;
  relatedDocuments: RelatedDocument[];
}

export function categorizeRelatedDocuments(
  items: RelatedDocument[]
): RelatedDocumentsCategory[] {
  const categories: RelatedDocumentsCategory[] = [
    {
      id: 'concepts',
      name: 'Concepts',
      matchers: [
        '/concepts/',
        '/concepts/module-federation/',
        '/concepts/decisions/',
      ],
      relatedDocuments: [],
    },
    {
      id: 'recipes',
      name: 'Guides',
      matchers: ['/recipes/', '/guides/'],
      relatedDocuments: [],
    },
    {
      id: 'reference',
      name: 'Reference',
      // TODO(caleb): including /technologies/ in the route will duplicate the display of `recipes/guides` so leaving off for now
      matchers: ['/workspace/', '/nx-api/', '/core-api/'],
      relatedDocuments: [],
    },
    {
      id: 'see-also',
      name: 'See also',
      matchers: ['/see-also/'],
      relatedDocuments: [],
    },
  ];

  items?.forEach((i) =>
    categories.forEach((c) => {
      if (c.matchers.some((m) => i.path.includes(m)))
        c.relatedDocuments.push(i);
    })
  );

  return categories.filter((c) => !!c.relatedDocuments.length);
}
