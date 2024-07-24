import {
  AmazonMusicIcon,
  ApplePodcastsIcon,
  IHeartRadioIcon,
  SpotifyIcon,
} from '@nx/nx-dev/ui-icons';

export function ListenOn(): JSX.Element {
  const platforms = [
    {
      name: 'Amazon Music',
      url: 'https://music.amazon.com/podcasts/a221fdad-36fd-4695-a5b4-038d7b99d284/the-enterprise-software-podcast-by-nx',
      icon: AmazonMusicIcon,
    },
    {
      name: 'Apple Podcasts',
      url: 'https://podcasts.apple.com/us/podcast/the-enterprise-software-podcast-by-nx/id1752704996',
      icon: ApplePodcastsIcon,
    },
    {
      name: 'iHeartRadio',
      url: 'https://www.iheart.com/podcast/269-the-enterprise-software-po-186891508/',
      icon: IHeartRadioIcon,
    },
    {
      name: 'Spotify',
      url: 'https://open.spotify.com/show/6Axjn4Qh7PUWlGbNqzE7J4',
      icon: SpotifyIcon,
    },
  ];

  return (
    <ul className="flex flex-wrap gap-6 sm:gap-4">
      {platforms.map((platform) => {
        return (
          <li
            key={platform.name}
            className="inline-block cursor-pointer place-items-center rounded-2xl border border-slate-100 bg-white p-4 text-slate-600 transition-all hover:scale-[1.02] hover:text-slate-950 dark:border-slate-800/60 dark:bg-slate-950  dark:text-slate-400 dark:hover:text-white"
          >
            <a
              href={platform.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex h-full w-full items-center justify-center"
            >
              <platform.icon className="h-8 w-8 shrink-0" />
            </a>
          </li>
        );
      })}
    </ul>
  );
}
