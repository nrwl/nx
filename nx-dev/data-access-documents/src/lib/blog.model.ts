export type BlogPostDataEntry = {
  title: string;
  content: string;
  description: string;
  authors: BlogAuthor[];
  date: string;
  cover_image: string | null;
  tags: string[];
  reposts: string[];
  updated?: string;
  pinned?: boolean;
  filePath: string;
  slug: string;
  youtubeUrl?: string;
  podcastYoutubeId?: string;
  podcastSpotifyId?: string;
  podcastAmazonUrl?: string;
  podcastAppleUrl?: string;
  podcastIHeartUrl?: string;
  published?: boolean;
  ogImage?: string;
  ogImageType?: string;
  metrics?: Array<{ value: string; label: string }>;
};

export type BlogAuthor = {
  name: string;
  image: string;
  twitter: string;
  github: string;
};
