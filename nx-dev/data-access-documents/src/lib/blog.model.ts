export type BlogPostFrontmatter = {
  title: string;
  description: string;
  authors: string[];
  date: string;
  updated?: string;
  cover_image: string;
  tags: string[];
  reposts: string[];
  pinned?: boolean;
};

export type BlogPostDataEntry = {
  content: string;
  frontmatter: BlogPostFrontmatter;
  filePath: string;
  slug: string;
};
