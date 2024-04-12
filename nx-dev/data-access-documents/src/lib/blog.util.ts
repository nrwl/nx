import { BlogPostDataEntry } from './blog.model';

export function sortPosts(posts: BlogPostDataEntry[]): BlogPostDataEntry[] {
  return posts.sort((a, b) => {
    if (a.frontmatter.pinned && !b.frontmatter.pinned) return -1;
    if (b.frontmatter.pinned && !a.frontmatter.pinned) return 1;
    return (
      new Date(b.frontmatter.date).getTime() -
      new Date(a.frontmatter.date).getTime()
    );
  });
}
