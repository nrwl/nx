import { BlogPostDataEntry } from './blog.model';

export function sortPosts(posts: BlogPostDataEntry[]): BlogPostDataEntry[] {
  return posts.sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (b.pinned && !a.pinned) return 1;
    return new Date(b.date).getTime() - new Date(a.date).getTime();
  });
}

export function sortPodcasts(posts: BlogPostDataEntry[]): BlogPostDataEntry[] {
  return posts.sort((a, b) => {
    if (a.episode && b.episode) {
      if (a.episode > b.episode) return -1;
      if (b.episode > a.episode) return 1;
    }
    return sortPosts([a, b])[0] === a ? -1 : 1;
  });
}
