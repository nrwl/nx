import { BlogPostDataEntry } from '@nx/nx-dev-data-access-documents/node-only';

// first five blog posts should prioritize pinned posts, then show recent posts
// if there are fewer than 5 pinned posts, fill remaining spots with newest posts by date
// then sort the final 5 posts by date so newer posts can appear before older pinned posts
export function sortFirstFivePosts(
  posts: BlogPostDataEntry[]
): BlogPostDataEntry[] {
  // Separate pinned and non-pinned posts
  const pinnedPosts = posts.filter((post) => post.pinned === true);
  const nonPinnedPosts = posts.filter((post) => post.pinned !== true);

  // Sort both groups by date (newest first)
  pinnedPosts.sort(
    (a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf()
  );
  nonPinnedPosts.sort(
    (a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf()
  );

  // Take up to 5 pinned posts, then fill remaining spots with newest non-pinned posts
  const selectedPosts = [
    ...pinnedPosts.slice(0, 5),
    ...nonPinnedPosts.slice(0, Math.max(0, 5 - pinnedPosts.length)),
  ];

  // Sort the final selection by date (newest first)
  // This allows newer non-pinned posts to appear before older pinned posts
  return selectedPosts
    .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf())
    .slice(0, 5);
}
