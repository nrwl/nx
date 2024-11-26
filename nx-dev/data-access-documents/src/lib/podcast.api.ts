import { BlogApi } from './blog.api';
import { PodcastDataEntry } from './podcast.model';

export class PodcastApi {
  _blogApi: BlogApi;

  constructor(options: { blogApi: BlogApi }) {
    this._blogApi = options.blogApi;
  }

  async getPodcastBlogs(): Promise<PodcastDataEntry[]> {
    return await this._blogApi.getBlogs((post) =>
      post.tags.map((t) => t.toLowerCase()).includes('podcast')
    );
  }
}
