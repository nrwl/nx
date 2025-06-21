'use client';
'use strict';
Object.defineProperty(exports, '__esModule', { value: true });
exports.EpisodePlayer = EpisodePlayer;
exports.PlatformLinks = PlatformLinks;
const tslib_1 = require('tslib');
const react_1 = require('react');
const nx_dev_ui_icons_1 = require('@nx/nx-dev-ui-icons');
const link_1 = tslib_1.__importDefault(require('next/link'));
function EpisodePlayer({
  podcastYoutubeId,
  podcastSpotifyId,
  amazonUrl,
  appleUrl,
  iHeartUrl,
}) {
  const [viewType, setViewType] = (0, react_1.useState)('audio');
  return (
    <div className="flex basis-2/3 flex-col items-center justify-center gap-2">
      {viewType === 'audio' ? (
        <>
          <iframe
            style={{ borderRadius: '12px' }}
            src={`https://open.spotify.com/embed/episode/${podcastSpotifyId}?utm_source=generator&theme=0`}
            width="100%"
            height="152"
            frameBorder="0"
            allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"
            loading="lazy"
            key="audio"
          ></iframe>
        </>
      ) : (
        <iframe
          style={{ borderRadius: '12px' }}
          width="100%"
          height="400"
          src={`https://www.youtube.com/embed/${podcastYoutubeId}?si=8rkgAzJfLfd-hxAA`}
          title="YouTube video player"
          frameBorder="0"
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
          referrerPolicy="strict-origin-when-cross-origin"
          allowFullScreen
          key="video"
        ></iframe>
      )}
      <div className="container my-1 flex">
        <div className="basis-1/2">
          {viewType === 'audio' && (
            <PlatformLinks
              amazonUrl={amazonUrl}
              appleUrl={appleUrl}
              iHeartUrl={iHeartUrl}
              podcastSpotifyId={podcastSpotifyId}
            />
          )}
        </div>
        <div className="flex basis-1/2 flex-wrap justify-end gap-6 sm:gap-4">
          <button
            className="flex shrink-0 items-center gap-2 text-slate-400 hover:text-slate-800 dark:text-slate-600 dark:hover:text-slate-200"
            onClick={() => setViewType(getOpposite(viewType))}
          >
            Switch to {getOpposite(viewType) === 'audio' ? 'Audio' : 'Video'}
          </button>
          <link_1.default
            className="flex shrink-0 items-center gap-2 text-slate-400 hover:text-slate-800 dark:text-slate-600 dark:hover:text-slate-200"
            href="/podcast"
          >
            More Podcasts
          </link_1.default>
        </div>
      </div>
    </div>
  );
}
function PlatformLinks({ amazonUrl, appleUrl, iHeartUrl, podcastSpotifyId }) {
  const platforms = [
    {
      name: 'Amazon Music',
      url: amazonUrl,
      icon: nx_dev_ui_icons_1.AmazonMusicIcon,
    },
    {
      name: 'Apple Podcasts',
      url: appleUrl,
      icon: nx_dev_ui_icons_1.ApplePodcastsIcon,
    },
    {
      name: 'iHeartRadio',
      url: iHeartUrl,
      icon: nx_dev_ui_icons_1.IHeartRadioIcon,
    },
    {
      name: 'Spotify',
      url: `https://open.spotify.com/episode/${podcastSpotifyId}?si=Nqd7F40hQXugagH8oDxxpA`,
      icon: nx_dev_ui_icons_1.SpotifyIcon,
    },
  ];
  return (
    <ul className="flex flex-wrap gap-6 sm:gap-4">
      {platforms
        .filter((platform) => !!platform.url)
        .map((platform) => {
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
                <platform.icon className="h-6 w-6 shrink-0" />
              </a>
            </li>
          );
        })}
    </ul>
  );
}
function getOpposite(viewMode) {
  if (viewMode === 'audio') return 'video';
  return 'audio';
}
