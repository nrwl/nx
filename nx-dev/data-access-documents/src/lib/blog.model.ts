export type BlogPostDataEntry = {
  title: string;
  content: string;
  description: string;
  authors: string[];
  date: string;
  cover_image: string | null;
  tags: string[];
  reposts: string[];
  updated?: string;
  pinned?: boolean;
  filePath: string;
  slug: string;
};
