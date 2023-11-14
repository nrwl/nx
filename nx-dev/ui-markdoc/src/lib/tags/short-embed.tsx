import {
  createContext,
  ReactNode,
  useContext,
  useLayoutEffect,
  useState,
} from 'react';
import { Schema, Tag } from '@markdoc/markdoc';
import { Transition } from '@headlessui/react';
import { Button } from '@nx/nx-dev/ui-common';
import { XMarkIcon } from '@heroicons/react/24/outline';

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
      .filter((child) => child && child.name === 'ShortVideo')
      .map((short) =>
        typeof short === 'object'
          ? {
              title: short?.attributes.title,
              embedUrl: short?.attributes.embedUrl,
            }
          : null
      );

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
}): JSX.Element | null {
  const [currentVideo, setCurrentVideo] = useState<VideoData>(videoData[0]);
  const [isShowing, setIsShowing] = useState(false);
  const [userInteraction, setUserInteraction] = useState(false);

  useLayoutEffect(() => {
    const [wrapperWidth, viewHeight] = [
      document.querySelector('#wrapper')?.clientWidth,
      window.innerHeight,
    ];
    const showShort =
      !!wrapperWidth && wrapperWidth > 800 && !!viewHeight && viewHeight > 750;

    const t = setTimeout(() => setIsShowing(showShort), 500);
    return () => {
      t && clearTimeout(t);
    };
  }, [setIsShowing]);

  if (!isShowing) return null;

  return (
    <ShortEmbedContext.Provider
      value={{ current: currentVideo, userInteraction }}
    >
      <aside id="short-embed" className="fixed w-80 bottom-5 right-5 z-50">
        <Transition
          appear={true}
          show={isShowing}
          enter="transition-all duration-1000"
          enterFrom="opacity-0 translate-y-full"
          enterTo="opacity-100 translate-y-0"
          leave="transition-all duration-1000"
          leaveFrom="opacity-100 translate-y-0"
          leaveTo="opacity-0 translate-y-full"
        >
          <div className="relative mt-12 w-full h-full rounded-xl shadow-xl coding flex flex-col border border-slate-200 bg-slate-50 p-4 leading-normal text-slate-800 subpixel-antialiased dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200">
            <Button
              size="small"
              variant="secondary"
              onClick={() => {
                setTimeout(() => setIsShowing(false), 500);
              }}
              className="absolute top-2 right-2"
              title="Close"
            >
              <XMarkIcon className="w-4 h-4" />
            </Button>
            <h3 className="text-center not-prose">Relevant Videos</h3>
            <div className="grid grid-cols-1 gap-4 justify-items-center w-full">
              {children}
              <div>
                <div className="text-base font-medium pb-1">Continue with:</div>
                <div className="flex flex-col gap-2">
                  {videoData
                    .filter(
                      ({ embedUrl }) => embedUrl !== currentVideo.embedUrl
                    )
                    .map((config) => {
                      const ytUrlPath = config.embedUrl.split('/');
                      const ytId = ytUrlPath[ytUrlPath.length - 1];
                      const imgUrl = `https://img.youtube.com/vi/${ytId}/0.jpg`;
                      return (
                        <div
                          key={ytId}
                          onClick={() => {
                            setUserInteraction(true);
                            setCurrentVideo(config);
                          }}
                          className="hover:cursor-pointer flex text-sm h-24 rounded-lg overflow-hidden border border-slate-200 bg-white/40 shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800"
                        >
                          <div className="w-32 shrink-0">
                            <img
                              className="!m-0"
                              src={imgUrl}
                              alt={`Another recommendation: ${config.title}`}
                            />
                          </div>
                          <div className="p-2 shrink overflow-ellipsis h-full w-full grid grid-cols-1 content-center">
                            {config.title}
                          </div>
                        </div>
                      );
                    })}
                </div>
              </div>
            </div>
          </div>
        </Transition>
      </aside>
    </ShortEmbedContext.Provider>
  );
}

export function ShortVideo({ embedUrl, title }: VideoData) {
  const { current, userInteraction } = useContext(ShortEmbedContext);

  if (embedUrl !== current?.embedUrl) {
    return null;
  }

  return (
    <div className="w-[216px] h-96 rounded-lg overflow-hidden">
      <iframe
        className="!m-0"
        width="100%"
        height="100%"
        src={`${embedUrl}?autoplay=1&loop=1${userInteraction ? '' : '&mute=1'}`}
        title="Two Places to Define Tasks | Nx Workspaces"
        frameBorder="0"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
      />
    </div>
  );
}
