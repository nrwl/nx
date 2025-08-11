import { BlogPostDataEntry } from './blog.model';

export function sortPosts(posts: BlogPostDataEntry[]): BlogPostDataEntry[] {
  return posts.sort((a, b) => {
    if (a.pinned === true && b.pinned !== true) return -1;
    if (b.pinned === true && a.pinned !== true) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}
