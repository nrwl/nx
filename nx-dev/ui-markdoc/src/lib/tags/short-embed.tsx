// TODO@ben: refactor to use HeadlessUI tabs
import {
  createContext,
  ReactNode,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import { Schema, Tag } from '@markdoc/markdoc';

interface VideoData {
  title: string;
  embedUrl: `https://www.youtube.com/embed/${string}`;
}

export const shortEmbeds: Schema = {
  render: 'ShortEmbeds',
  attributes: {},
  transform(node, config) {
    const videoData = node
      .transformChildren(config)
      .filter((child) => {
        console.log(child?.name);
        return child && child.name === 'ShortVideo';
      })
      .map((tab) => {
        console.log(tab);
        return typeof tab === 'object'
          ? { title: tab?.attributes.title, embedUrl: tab?.attributes.embedUrl }
          : null;
      });

    return new Tag(this.render, { videoData }, node.transformChildren(config));
  },
};

export const shortVideo: Schema = {
  render: 'ShortVideo',
  attributes: {
    title: {
      type: 'String',
    },
    embedUrl: {
      type: 'String',
    },
  },
};

export const ShortEmbedContext = createContext<{
  current: VideoData | null;
  userInteraction: boolean;
}>({ current: null, userInteraction: false });

export function ShortEmbeds({
  videoData,
  children,
}: {
  videoData: VideoData[];
  children: ReactNode;
}) {
  const [currentVideo, setCurrentVideo] = useState<VideoData>(videoData[0]);
  const [show, setShow] = useState(true);
  const [userInteraction, setUserInteraction] = useState(false);
  const [fadingOut, setFadingOut] = useState(false);
  console.log(videoData);

  useLayoutEffect(() => {
    console.log('useLayoutEffect');
    const wrapperWidth = document.querySelector('#wrapper')?.clientWidth;
    const showShort = !wrapperWidth || wrapperWidth > 800;
    setShow(showShort);
  }, [setShow]);

  if (!show) {
    return null;
  }

  return (
    <ShortEmbedContext.Provider
      value={{ current: currentVideo, userInteraction }}
    >
      <div
        id="short-embed"
        className={`fixed bottom-10 right-10 bg-slate-800 rounded-lg p-2 border-opacity-100 border-4 border-slate-400 drop-shadow-2xl z-50 ${
          fadingOut ? 'fade-out' : 'fade-in'
        }`}
      >
        <button
          onClick={() => {
            setFadingOut(true);
            setTimeout(() => setShow(false), 500);
          }}
          className="fixed top-2 right-2 bg-slate-400 text-slate-900 rounded-md px-2"
        >
          X
        </button>
        <h2 className="text-center not-prose">Relevant Videos</h2>
        <section className="grid grid-cols-1 justify-items-cente w-full">
          {children}
          <div>
            <h3 className="text-center not-prose">More Videos:</h3>
            <ul className="flex flex-row list-none justify-between">
              {videoData
                .filter(({ embedUrl }) => embedUrl !== currentVideo.embedUrl)
                .map((config) => {
                  const ytUrlPath = config.embedUrl.split('/');
                  const ytId = ytUrlPath[ytUrlPath.length - 1];
                  const imgUrl = `https://img.youtube.com/vi/${ytId}/0.jpg`;
                  return (
                    <button
                      key={config.embedUrl}
                      onClick={() => {
                        setUserInteraction(true);
                        setCurrentVideo(config);
                      }}
                      className="m-2 p-2 short-picker max-w-sm bg-slate-500 rounded-md"
                    >
                      <li className="flex flex-col place-content-center text-center">
                        <img
                          src={imgUrl}
                          alt={`Another recommendation: ${config.title}`}
                          width="200"
                          className="not-prose w-200"
                        />
                        <label>{config.title}</label>
                      </li>
                    </button>
                  );
                })}
            </ul>
          </div>
        </section>
      </div>
    </ShortEmbedContext.Provider>
  );
}

export function ShortVideo({ embedUrl, title }: VideoData) {
  const { current, userInteraction } = useContext(ShortEmbedContext);

  if (embedUrl !== current?.embedUrl) {
    return null;
  }

  return (
    <div className="not-prose overflow-y-auto bg-white dark:bg-slate-900 dark:prose-invert mt-4 max-w-3xl">
      <iframe
        className="w-281"
        width="281"
        height="500"
        src={`${embedUrl}?autoplay=1&loop=1${userInteraction ? '' : '&mute=1'}`}
        title="Two Places to Define Tasks | Nx Workspaces"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      ></iframe>
    </div>
  );
}
