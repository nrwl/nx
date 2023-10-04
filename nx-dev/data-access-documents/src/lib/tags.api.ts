import { RelatedDocument } from '@nx/nx-dev/models-document';

export class TagsApi {
  private readonly manifest: Record<string, RelatedDocument[]>;
  constructor(private readonly tags: Record<string, RelatedDocument[]>) {
    if (!tags) {
      throw new Error('tags property cannot be undefined');
    }

    this.manifest = structuredClone(this.tags);
  }

  getAssociatedItems(tag: string): RelatedDocument[] {
    const items: RelatedDocument[] | null = this.manifest[tag] || null;

    if (!items) throw new Error(`No associated items found for tag: "${tag}"`);

    return items;
  }

  getAssociatedItemsFromTags(tags: string[]): RelatedDocument[] {
    return this.sortAndDeduplicateItems(
      tags.map((t) => this.getAssociatedItems(t))
    );
  }

  sortAndDeduplicateItems(tags: RelatedDocument[][]): RelatedDocument[] {
    return tags.flat().reduce((acc, item: RelatedDocument) => {
      if (acc.findIndex((curr) => curr.file === item.file) === -1) {
        acc.push(item);
      }
      return acc;
    }, [] as RelatedDocument[]);
  }
}
