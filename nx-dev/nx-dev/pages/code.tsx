import React from 'react';
import {
  AnimatePresence,
  AnimateSharedLayout,
  motion,
  useAnimation,
} from 'framer-motion';

const CHAR_DELAY = 75;
const GROUP_DELAY = 1000;
const TRANSITION = { duration: 5 };

const typing = (line: string, delay: number = 0): any =>
  Array.from(line).map((char, index) => (
    <motion.span
      key={[char, index].join('-')}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{
        delay: index * 0.04 + delay,
        ease: 'linear',
        duration: 0.1,
      }}
    >
      {char}
    </motion.span>
  ));
const rows = [];
const something = {
  visible: {
    opacity: 1,
    transition: {
      when: 'beforeChildren',
      staggerChildren: 0.3,
    },
  },
  hidden: {
    opacity: 0,
    transition: {
      when: 'afterChildren',
    },
  },
};

export function Code() {
  return (
    <>
      <div
        className="coding inverse-toggle px-5 pt-4 shadow-lg text-gray-200 text-xs font-mono subpixel-antialiased
              bg-gray-800  pb-6 pt-4 rounded-lg leading-normal max-w-full overflow-hidden h-96"
      >
        <div className="top mb-2 flex">
          <div className="h-3 w-3 bg-red-500 rounded-full" />
          <div className="ml-2 h-3 w-3 bg-yellow-300 rounded-full" />
          <div className="ml-2 h-3 w-3 bg-green-500 rounded-full" />
        </div>
        <div className="mt-4 flex">
          <span className="text-green-nx-base mr-2">/workspace ➜</span>
          <p className="flex-1 typing items-center">
            {typing('npx create-nx-workspace ludicrous-narwhals').map((x) => x)}
          </p>
        </div>
        <div className="mt-2 flex flex-col whitespace-pre">
          <AnimateSharedLayout>
            {/*LOADING*/}
            <motion.div
              layout
              className="inline-block items-center bg-green-nx-base"
              initial={{ width: '0%', height: '12px' }}
              animate={{ width: '100%' }}
              transition={{ delay: 2.4, ease: 'easeOut', duration: 0.25 }}
            />
            {/*FRAMEWORK SELECTION*/}
            <motion.div
              layout
              className="mt-2 flex-1 items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 3, ease: 'easeOut', duration: 0.1 }}
            >
              What to create in the new workspace{' '}
              <motion.span
                className="text-green-nx-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 8, ease: 'easeOut', duration: 0.25 }}
              >
                react [a workspace with a single React application]
              </motion.span>
            </motion.div>
            <motion.div
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1],
                position: ['relative', 'relative'],
                transitionEnd: {
                  opacity: 0,
                  position: 'absolute',
                },
              }}
              transition={{
                delay: 4,
                ease: 'easeOut',
                duration: 4,
                times: [0, 0.12],
              }}
            >
              {/*SELECTION ARROW*/}
              <motion.div
                className="absolute -left-4 top-0 text-green-nx-base"
                initial={{ y: 0 }}
                animate={{ y: 18 }}
                transition={{
                  delay: 5,
                  ease: 'easeOut',
                  duration: 0.25,
                }}
              >
                ❯
              </motion.div>
              <motion.span
                initial={{ color: '#34D399' }}
                animate={{ color: '#E5E7EB' }}
                transition={{ delay: 5, ease: 'easeOut', duration: 0.25 }}
              >
                empty [an empty workspace with a layout that works best for
                building apps]
              </motion.span>
              <br />
              <motion.span
                initial={{ color: '#E5E7EB' }}
                animate={{ color: '#34D399' }}
                transition={{ delay: 5, ease: 'easeOut', duration: 0.25 }}
              >
                react [a workspace with a single React application]
              </motion.span>
              <br />
              angular [a workspace with a single Angular application]
              <br />
              next.js [a workspace with a single Next.js application]
              <br />
              nest [a workspace with a single Nest application]
              <br />
              express [a workspace with a single Express application]
              <br />
              web components [a workspace with a single app built using web
              components]
              <br />
              <span className="text-gray-500">(Use arrow keys)</span>
            </motion.div>
            {/*APPLICATION NAME*/}
            <motion.div
              className="flex-1 items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 9, ease: 'easeOut', duration: 0.25 }}
            >
              Application name{' '}
              <span className="text-green-nx-base">
                {typing('tuxboard', 10).map((x) => x)}
              </span>
            </motion.div>
            {/*STYLESHEET FORMAT*/}
            <motion.div
              layout
              className="flex-1 items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 11, ease: 'easeOut', duration: 0.1 }}
            >
              Default stylesheet format{' '}
              <motion.span
                className="text-green-nx-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 16, ease: 'easeOut', duration: 0.25 }}
              >
                styled-components [ https://styled-components.com ]
              </motion.span>
            </motion.div>
            <motion.div
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1],
                position: ['relative', 'relative'],
                transitionEnd: {
                  opacity: 0,
                  position: 'absolute',
                },
              }}
              transition={{
                delay: 12,
                ease: 'easeOut',
                duration: 4,
                times: [0, 0.12],
              }}
            >
              {/*SELECTION ARROW*/}
              <motion.div
                className="absolute -left-4 top-0 text-green-nx-base"
                initial={{ y: 0 }}
                animate={{ y: 72 }}
                transition={{
                  delay: 13,
                  ease: 'easeOut',
                  duration: 0.25,
                }}
              >
                ❯
              </motion.div>
              <motion.span
                initial={{ color: '#34D399' }}
                animate={{ color: '#E5E7EB' }}
                transition={{ delay: 13, ease: 'easeOut', duration: 0.25 }}
              >
                CSS
              </motion.span>
              <br />
              SASS(.scss) [ http://sass-lang.com ] <br />
              Stylus(.styl)[ http://stylus-lang.com ] <br />
              LESS [ http://lesscss.org ] <br />
              <motion.span
                initial={{ color: '#E5E7EB' }}
                animate={{ color: '#34D399' }}
                transition={{ delay: 13, ease: 'easeOut', duration: 0.25 }}
              >
                styled-components [ https://styled-components.com ]
              </motion.span>
              <br />
              emotion [ https://emotion.sh ] <br />
              styled-jsx [ https://www.npmjs.com/package/styled-jsx ] <br />
              <span className="text-gray-500">(Use arrow keys)</span>
            </motion.div>
            {/*NX CLOUD*/}
            <motion.div
              layout
              className="flex-1 items-center"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 17, ease: 'easeOut', duration: 0.1 }}
            >
              Use Nx Cloud? (It's free and doesn't require registration.){' '}
              <motion.span
                className="text-green-nx-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 22.4, ease: 'easeOut', duration: 0.25 }}
              >
                Yes
              </motion.span>
            </motion.div>
            <motion.div
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 1],
                position: ['relative', 'relative'],
                transitionEnd: {
                  opacity: 0,
                  position: 'absolute',
                },
              }}
              transition={{
                delay: 18,
                ease: 'easeOut',
                duration: 4,
                times: [0, 0.12],
              }}
            >
              {/*SELECTION ARROW*/}
              <motion.div
                className="absolute -left-4 top-0 text-green-nx-base"
                initial={{ y: 18 }}
                animate={{ y: 0 }}
                transition={{
                  delay: 19,
                  ease: 'easeOut',
                  duration: 0.25,
                }}
              >
                ❯
              </motion.div>
              <motion.span
                initial={{ color: '#E5E7EB' }}
                animate={{ color: '#34D399' }}
                transition={{ delay: 19, ease: 'easeOut', duration: 0.25 }}
              >
                Yes
              </motion.span>
              <br />
              <motion.span
                initial={{ color: '#34D399' }}
                animate={{ color: '#E5E7EB' }}
                transition={{ delay: 19, ease: 'easeOut', duration: 0.25 }}
              >
                No
              </motion.span>
              <br />
              <span className="text-gray-500">(Use arrow keys)</span>
            </motion.div>
            {/*CREATING NX WORKSPACE*/}
            <motion.div
              layout
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 23, ease: 'easeOut', duration: 0.1 }}
            >
              <span className="px-1 py-0.5 bg-green-nx-base">NX</span> Nx is
              creating your workspace. To make sure the command works reliably
              in all environments, and that the preset is applied correctly, Nx
              will run "yarn install" several times. Please wait.
            </motion.div>
            <motion.div
              layout
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 23.4, ease: 'easeOut', duration: 0.1 }}
            >
              Creating your workspace
            </motion.div>
            {/*LOADING*/}
            <motion.div
              layout
              className="inline-block items-center bg-green-nx-base"
              initial={{ width: '0%', height: '12px' }}
              animate={{ width: '100%' }}
              transition={{ delay: 23.6, ease: 'easeOut', duration: 0.25 }}
            />
            {/*NX WORKSPACE CREATED*/}
            <motion.div
              layout
              className="mt-2"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 23.8, ease: 'easeOut', duration: 0.1 }}
            >
              <span className="px-1 py-0.5 bg-green-nx-base">NX SUCCESS</span>{' '}
              Nx has successfully created the workspace.
              <br />
              <br />
              ———————————————————————————————————————————————
              <br />
              <br />
              <span className="px-1 py-0.5 bg-green-nx-base">NX</span>
              <span className="ml-1 px-1 py-0.5 bg-yellow-500">NOTE</span> First
              time using Nx? Check out this interactive Nx tutorial.
              <br />
              <span className="cursor-pointer opacity-50 hover:underline hover:opacity-100">
                https://nx.dev/react/tutorial/01-create-application
              </span>
              <br />
              Prefer watching videos? Check out this free Nx course on
              Egghead.io.
              <br />
              <span className="cursor-pointer opacity-50 hover:underline hover:opacity-100">
                https://egghead.io/playlists/scale-react-development-with-nx-4038
              </span>
            </motion.div>
          </AnimateSharedLayout>
        </div>
      </div>
    </>
  );
}

export default Code;
