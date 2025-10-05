import { motion } from 'framer-motion';
import {
  CheckCircleIcon,
  CheckIcon,
  ChevronDownIcon,
} from '@heroicons/react/24/outline';
import { useState } from 'react';
import { Popover } from '@nx/graph-ui-common';
import { PrimaryAction } from '../migrate';

export interface MigrationDoneProps {
  onCancel: () => void;
  onFinish: (squash: boolean) => void;
  shouldSquashCommits: boolean;
}

export function MigrationDone({
  onCancel,
  onFinish,
  shouldSquashCommits,
}: MigrationDoneProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [squashCommits, setSquashCommits] = useState(shouldSquashCommits);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5, ease: 'easeOut' }}
      className="my-10 flex flex-col items-center justify-center gap-4"
    >
      <motion.div
        initial={{ scale: 0 }}
        animate={{ scale: 1 }}
        transition={{
          type: 'spring',
          stiffness: 300,
          damping: 10,
          delay: 0.3,
        }}
        className="flex h-16 w-16 items-center justify-center text-6xl"
      >
        <span role="img" aria-label="checkmark">
          <CheckCircleIcon className="h-12 w-12 text-green-700 dark:text-green-400" />
        </span>
      </motion.div>

      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="rounded-md border border-green-500/30 bg-green-50 px-6 py-5 text-green-700 shadow-lg dark:border-green-900/30 dark:bg-green-900/10 dark:text-green-500"
      >
        <h2 className="flex items-center gap-3 text-xl font-bold">
          All migrations completed
        </h2>
      </motion.div>
      <div className="mt-6 flex items-center justify-center gap-4">
        <motion.button
          whileTap={{ scale: 0.95 }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.8 }}
          onClick={onCancel}
          className="flex w-full items-center rounded-md border border-slate-300 bg-white px-6 py-3 text-sm font-medium text-slate-700 shadow-sm transition-colors hover:bg-slate-50 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-2 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
        >
          Cancel
        </motion.button>
        <div className="flex">
          <motion.button
            whileTap={{ scale: 0.95 }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.8 }}
            onClick={() => onFinish(squashCommits)}
            type="button"
            title={
              squashCommits
                ? PrimaryAction.FinishSquashingCommits
                : PrimaryAction.FinishWithoutSquashingCommits
            }
            className="whitespace-nowrap rounded-l-md border border-blue-700 bg-blue-500 px-6 py-3 text-sm font-medium text-white shadow-sm hover:bg-blue-600 dark:border-blue-700 dark:bg-blue-600 dark:text-white hover:dark:bg-blue-700"
          >
            {squashCommits
              ? PrimaryAction.FinishSquashingCommits
              : PrimaryAction.FinishWithoutSquashingCommits}
          </motion.button>
          <div className="relative flex">
            <motion.button
              whileTap={{ scale: 0.95 }}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.8 }}
              type="button"
              onClick={() => setIsOpen((prev) => !prev)}
              className="border-l-1 flex items-center rounded-r-md border border-blue-700 bg-blue-500 px-2 py-2 text-sm font-medium text-white shadow-sm hover:bg-blue-700 dark:border-blue-700 dark:bg-blue-700 dark:text-white hover:dark:bg-blue-800"
            >
              <ChevronDownIcon className="h-4 w-4" />
            </motion.button>
            <Popover
              isOpen={isOpen}
              onClose={() => setIsOpen(false)}
              position={{
                left: '-2rem',
                top: '-6.75rem',
              }}
            >
              <ul className="p-2">
                <li
                  className="flex cursor-pointer items-center gap-2 p-2 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                  onClick={() => {
                    setSquashCommits(true);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={squashCommits ? 'inline-block' : 'opacity-0'}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span>Squash commits</span>
                </li>
                <li
                  className="flex cursor-pointer items-center gap-2 p-2 hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
                  onClick={() => {
                    setSquashCommits(false);
                    setIsOpen(false);
                  }}
                >
                  <span
                    className={!squashCommits ? 'inline-block' : 'opacity-0'}
                  >
                    <CheckIcon className="h-4 w-4" />
                  </span>
                  <span>Do not squash commits</span>
                </li>
              </ul>
            </Popover>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
