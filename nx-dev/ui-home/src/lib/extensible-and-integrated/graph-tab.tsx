import { motion } from 'framer-motion';
import { transition, variants } from './motion.helpers';

export function GraphTab(): JSX.Element {
  return (
    <motion.div
      initial="hidden"
      variants={variants}
      animate="visible"
      transition={transition}
      exit="hidden"
      className="wrapper relative my-8 flex h-full flex-col items-center space-y-12 overflow-hidden lg:flex-row"
    >
      <div
        className="coding z-10 w-96 shrink-0 grow-0 overflow-hidden rounded-lg border border-slate-200 bg-slate-50 p-4 font-mono
              text-xs leading-normal text-slate-800 subpixel-antialiased shadow-lg dark:border-slate-700 dark:bg-slate-800 dark:text-slate-200"
      >
        <div className="flex items-center">
          <p>
            <span className="text-base text-purple-600 dark:text-fuchsia-500">
              →
            </span>{' '}
            <span className="mx-1 text-green-600 dark:text-green-400">
              ~/workspace
            </span>{' '}
            <span>$</span>
          </p>
          <p className="typing mt-0.5 flex-1 pl-2">nx graph</p>
        </div>
        <div className="mt-2 flex">
          <p className="typing flex-1 items-center">
            <span className="bg-yellow-300 px-1 py-0.5 dark:bg-yellow-600">
              Nx
            </span>{' '}
            Project graph started at{' '}
            <span className="underline">http://127.0.0.1:4211</span>
            <br />
          </p>
        </div>
      </div>
      <div className="relative -top-5 mr-0.5 hidden grow items-center lg:flex">
        <span className="absolute top-0 left-0 -mt-1 -ml-1 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-500" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
        </span>
        <span className="absolute top-0 right-0 -mt-1 -mr-1 flex h-2 w-2">
          <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-blue-500 opacity-75 dark:bg-sky-500" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-slate-200 dark:bg-slate-700" />
        </span>
        <div className="-m-0.5 h-0.5 w-full bg-slate-200 dark:bg-slate-700" />
      </div>
      <div className="z-10 h-auto overflow-hidden rounded-lg border border-slate-200 shadow dark:border-slate-700 lg:min-h-[485px] lg:w-[690px]">
        <div className="flex h-7 w-full items-center justify-start space-x-1.5 bg-slate-200 px-3 dark:bg-slate-700">
          <span className="h-2 w-2 rounded-full bg-red-400"></span>
          <span className="h-2 w-2 rounded-full bg-yellow-400"></span>
          <span className="h-2 w-2 rounded-full bg-green-400"></span>
        </div>
        <div className="w-full bg-transparent dark:hidden">
          <video preload="true" autoPlay={true} loop muted playsInline={true}>
            <source src="/videos/light.webm" type="video/webm" />
            <source src="/videos/light.mp4" type="video/mp4" />
          </video>
        </div>
        <div className="hidden w-full bg-slate-700 dark:flex">
          <video preload="true" autoPlay={true} loop muted playsInline={true}>
            <source src="/videos/dark.webm" type="video/webm" />
            <source src="/videos/dark.mp4" type="video/mp4" />
          </video>
        </div>
      </div>
    </motion.div>
  );
}
