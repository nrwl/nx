import { RelatedDocument } from '@nrwl/nx-dev/models-document';

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
    return tags
      .flat()
      .filter((item, index, items) => items.indexOf(item) === index);
  }
}
