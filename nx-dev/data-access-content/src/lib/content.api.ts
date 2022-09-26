import { ContentData } from '@nrwl/nx-dev/models-content';

export class ContentApi {
  contentIndex: ContentData[];
  constructor(
    private options: {
      publicContentRoot: string;
      contentIndex: ContentData[];
    }
  ) {
    if (!options.publicContentRoot) {
      throw new Error('public content root cannot be undefined');
    }
    if (!options.contentIndex) {
      throw new Error('public content index cannot be undefined');
    }
    this.contentIndex = options.contentIndex;
  }

  getContentByTag(tag: string): ContentData[] {
    return this.contentIndex.filter((content) => content.tags.includes(tag));
  }
}
