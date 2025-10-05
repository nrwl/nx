import { BlogApi } from './blog.api';
import { WebinarDataEntry } from './webinar.model';

export class WebinarApi {
  _blogApi: BlogApi;

  constructor(options: { blogApi: BlogApi }) {
    this._blogApi = options.blogApi;
  }

  async getWebinarBlogs(): Promise<WebinarDataEntry[]> {
    return await this._blogApi.getBlogs((post) =>
      post.tags.map((t) => t.toLowerCase()).includes('webinar')
    );
  }
}
