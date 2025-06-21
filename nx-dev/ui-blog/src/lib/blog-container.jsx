'use client';
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.sortFirstFivePosts = sortFirstFivePosts;
exports.BlogContainer = BlogContainer;
const tslib_1 = require('tslib');
const more_blogs_1 = require('./more-blogs');
const featured_blogs_1 = require('./featured-blogs');
const react_1 = require('react');
const filters_1 = require('./filters');
const navigation_1 = require('next/navigation');
const link_1 = tslib_1.__importDefault(require('next/link'));
const topics_1 = require('./topics');
const outline_1 = require('@heroicons/react/24/outline');
// first five blog posts should prioritize pinned posts, then show recent posts
// excluding any posts that have specific slugs we want to deprioritize
function sortFirstFivePosts(posts) {
  // Separate posts: pinned-able posts first
  const allowedPinnedPosts = posts.filter((p) => p.pinned !== false);
  allowedPinnedPosts.sort(
    (a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf()
  );
  return allowedPinnedPosts.slice(0, 5);
}
function BlogContainer({ blogPosts, tags }) {
  const searchParams = (0, navigation_1.useSearchParams)();
  const [filteredList, setFilteredList] = (0, react_1.useState)(blogPosts);
  // Only show filters that have blog posts
  const filters = (0, react_1.useMemo)(() => {
    return [
      topics_1.ALL_TOPICS[0],
      ...topics_1.ALL_TOPICS.filter((filter) => tags.includes(filter.value)),
    ];
  }, [tags]);
  const {
    initialFirstFive,
    initialRest,
    initialSelectedFilterHeading,
    initialSelectedFilter,
  } = (0, react_1.useMemo)(
    () => initializeFilters(blogPosts, searchParams),
    [blogPosts, searchParams]
  );
  const [firstFiveBlogs, setFirstFiveBlogs] = (0, react_1.useState)(
    initialFirstFive
  );
  const [remainingBlogs, setRemainingBlogs] = (0, react_1.useState)(
    initialRest
  );
  const [selectedFilterHeading, setSelectedFilterHeading] = (0,
  react_1.useState)(initialSelectedFilterHeading);
  function updateBlogPosts() {
    const firstFive = sortFirstFivePosts(filteredList);
    setFirstFiveBlogs(firstFive);
    // Get the remaining blogs, sorted by date (unpinned posts after the first 5)
    const firstFiveSlugs = new Set(firstFive.map((post) => post.slug));
    const remaining = filteredList
      .filter((post) => !firstFiveSlugs.has(post.slug))
      .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
    setRemainingBlogs(remaining);
  }
  (0, react_1.useEffect)(() => updateBlogPosts(), [filteredList]);
  return (
    <main id="main" role="main" className="w-full py-8">
      <div className="mx-auto mb-8 w-full max-w-[1088px] px-8">
        <div className="mb-12 mt-20 flex items-center justify-between">
          <header>
            <h1
              id="blog-title"
              className="text-xl font-semibold tracking-tight text-slate-900 md:text-2xl dark:text-slate-100"
            >
              {selectedFilterHeading}
            </h1>
          </header>
          <div className="flex items-center justify-end md:justify-start">
            <filters_1.Filters
              blogs={blogPosts}
              filters={filters}
              initialSelectedFilter={initialSelectedFilter}
              setFilteredList={setFilteredList}
              setSelectedFilterHeading={setSelectedFilterHeading}
            />
          </div>
        </div>
        <featured_blogs_1.FeaturedBlogs blogs={firstFiveBlogs} />
        {!!remainingBlogs.length && (
          <>
            <div className="mx-auto mb-8 mt-20 flex items-center justify-between border-b-2 border-slate-300 pb-3 text-sm dark:border-slate-700">
              <h2 className="font-semibold">More blogs</h2>
              <div className="flex gap-2">
                <link_1.default
                  href="/blog/rss.xml"
                  aria-label="RSS feed"
                  prefetch={false}
                >
                  <outline_1.RssIcon className="h-5 w-5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" />
                </link_1.default>
                <link_1.default
                  href="/blog/atom.xml"
                  aria-label="Atom feed"
                  prefetch={false}
                >
                  <outline_1.AtSymbolIcon className="h-5 w-5 text-slate-600 hover:text-slate-800 dark:text-slate-400 dark:hover:text-slate-200" />
                </link_1.default>
              </div>
            </div>
            <more_blogs_1.MoreBlogs blogs={remainingBlogs} />
          </>
        )}
      </div>
    </main>
  );
}
function initializeFilters(blogPosts, searchParams) {
  const filterBy = searchParams.get('filterBy');
  const firstFive = sortFirstFivePosts(blogPosts);
  const firstFiveSlugs = new Set(firstFive.map((post) => post.slug));
  const remaining = blogPosts
    .filter((post) => !firstFiveSlugs.has(post.slug))
    .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
  const defaultState = {
    initialFirstFive: firstFive,
    initialRest: remaining,
    initialSelectedFilterHeading: 'All Blogs',
    initialSelectedFilter: 'All',
  };
  if (!filterBy) {
    return defaultState;
  }
  const result = blogPosts.filter((post) => post.tags.includes(filterBy));
  const initialFilter = topics_1.ALL_TOPICS.find(
    (filter) => filter.value === filterBy
  );
  const filteredFirstFive = sortFirstFivePosts(result);
  const filteredFirstFiveSlugs = new Set(
    filteredFirstFive.map((post) => post.slug)
  );
  const filteredRemaining = result
    .filter((post) => !filteredFirstFiveSlugs.has(post.slug))
    .sort((a, b) => new Date(b.date).valueOf() - new Date(a.date).valueOf());
  return {
    initialFirstFive: filteredFirstFive,
    initialRest: filteredRemaining,
    initialSelectedFilterHeading: initialFilter?.heading || 'All Blogs',
    initialSelectedFilter: initialFilter?.value || 'All',
  };
}
