export interface PodcastData {
  slug: string;
  title: string;
  spotifySlug: string;
  youtubeId: string;
  duration: string;
  squareImageUrl: string;
  guestImageUrl?: string;
  date: Date;
  episodeDescription: string;
}

export const data: PodcastData[] = [
  {
    slug: '1-Hicham-El-Hammouchi',
    title: 'Episode 1: Hicham El Hammouchi',
    spotifySlug:
      'The-Enterprise-Software-Podcast-By-Nx-1--Hicham-El-Hamouchi-e2l0302',
    youtubeId: '8iiLB_2djZ8',
    duration: '2:03:50',
    guestImageUrl:
      'https://pbs.twimg.com/profile_images/1490455285/Photo_031708_003_400x400.jpg',
    squareImageUrl: '/documentation/podcast/images/episode-1-square.jpg',
    date: new Date('2024-6-18'),
    episodeDescription: `In this episode, Zach DeRose from Nx chats with Hicham El Hammouchi, a veteran in enterprise software. Hicham dives into his background, sharing his career journey and the wealth of experience he's gathered along the way.
They tackle the tough challenges that companies face in software development. Hicham offers practical insights and real-life examples from his own career, making complex issues easier to understand. He also shares some tried-and-true strategies for overcoming these hurdles, emphasizing the importance of teamwork and effective project management.
As the chat continues, Zach and Hicham explore the latest tech trends and innovations that are shaking up the industry. Hicham's forward-thinking views provide a sneak peek into the future of enterprise software. They also discuss detailed case studies of successful projects, highlighting the importance of staying focused on customer needs and feedback.`,
  },
];

const dataBySlug: Record<string, PodcastData> = data.reduce((acc, curr) => {
  acc[curr.slug] = curr;
  return acc;
}, {} as any);

export const getPodcastDataBySlug = (slug: string) => {
  const data = dataBySlug[slug];
  if (!data) {
    throw new Error(`No data associated with slug: ${slug}`);
  }
  return data;
};

export const getNextAndPreviousEpisodes = (
  slug: string
): { previous: PodcastData | undefined; next: PodcastData | undefined } => {
  const targetIndex = data.findIndex((v) => v.slug === slug);
  const next = targetIndex <= 0 ? undefined : data[targetIndex - 1];
  const previous =
    targetIndex === data.length - 1 ? undefined : data[targetIndex + 1];
  return { next, previous };
};
