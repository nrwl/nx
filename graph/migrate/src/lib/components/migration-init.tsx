import { WrenchScrewdriverIcon } from '@heroicons/react/24/outline';
import { motion } from 'framer-motion';

export function MigrationInit({ onStart }: { onStart: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 30 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.6, ease: 'easeOut' }}
      className="flex h-full flex-col items-center justify-center gap-6 px-6 py-12 text-center"
    >
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.2 }}
        className="text-6xl"
      >
        <span role="img" aria-label="tools">
          <WrenchScrewdriverIcon className="h-12 w-12" />
        </span>
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, delay: 0.4 }}
        className="text-2xl font-semibold text-gray-800 dark:text-white"
      >
        Ready to Migrate
      </motion.h1>

      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.4, delay: 0.6 }}
        className="max-w-xl text-base text-gray-600 dark:text-gray-400"
      >
        Welcome to the Migrate UI. This tool will guide you through updating
        your workspace. Click the button below to start running migrations.
      </motion.p>

      <motion.button
        whileHover={{ scale: 1.05 }}
        whileTap={{ scale: 0.95 }}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.8 }}
        onClick={onStart}
        className="mt-4 rounded-md bg-blue-600 px-6 py-3 text-sm font-medium text-white shadow-md transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-400 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
      >
        Start Migration
      </motion.button>
    </motion.div>
  );
}
