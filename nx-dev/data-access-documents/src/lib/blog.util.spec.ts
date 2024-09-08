import { sortPosts } from './blog.util';

describe('sortPosts', () => {
  test('sort from latest to earliest', () => {
    const posts = [
      createPost({ date: '2022-01-01', title: 'Post 1', slug: 'post-1' }),
      createPost({ date: '2023-01-01', title: 'Post 2', slug: 'post-2' }),
    ];

    const results = sortPosts(posts);

    expect(results.map((p) => p.slug)).toEqual(['post-2', 'post-1']);
  });

  test('latest pinned posts are presented first', () => {
    const posts = [
      createPost({
        date: '2023-01-01',
        title: 'Post 1',
        slug: 'post-1',
        pinned: true,
      }),
      createPost({ date: '2023-02-01', title: 'Post 2', slug: 'post-2' }),
      createPost({
        date: '2023-03-01',
        title: 'Post 3',
        slug: 'post-3',
        pinned: true,
      }),
      createPost({
        date: '2023-04-01',
        title: 'Post 4',
        slug: 'post-4',
        pinned: true,
      }),
      createPost({ date: '2023-05-01', title: 'Post 5', slug: 'post-5' }),
    ];

    const results = sortPosts(posts);

    expect(results.map((p) => p.slug)).toEqual([
      'post-4',
      'post-3',
      'post-1',
      'post-5',
      'post-2',
    ]);
  });
});

function createPost(data: {
  date: string;
  title: string;
  slug: string;
  pinned?: boolean;
}) {
  return {
    content: '',
    filePath: `${data.slug}.md`,
    slug: data.slug,
    date: data.date,
    title: data.title,
    description: '',
    authors: [],
    ogImage: '',
    ogImageType: '',
    cover_image: '',
    tags: [],
    reposts: [],
    pinned: data.pinned ?? undefined,
  };
}
