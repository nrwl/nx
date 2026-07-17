// nx-ignore-next-line
import type { MigrationDetailsWithId } from 'nx/src/config/misc-interfaces';
// nx-ignore-next-line
import { FileChange } from 'nx/src/devkit-exports';

import {
  ArrowPathIcon,
  CheckCircleIcon,
  ClockIcon,
  CodeBracketIcon,
  ExclamationCircleIcon,
  ListBulletIcon,
  PlayIcon,
  SparklesIcon,
} from '@heroicons/react/24/outline';
import { Pill } from '@nx/graph-internal-ui-project-details';
import {
  useState,
  forwardRef,
  useImperativeHandle,
  useEffect,
  type ReactNode,
} from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import type { Interpreter } from 'xstate';
import type {
  AutomaticMigrationState,
  AutomaticMigrationEvents,
} from '../state/automatic/types';
import { useSelector } from '@xstate/react';
import {
  currentMigrationHasChanges,
  getMigrationType,
  isMigrationRunning,
} from '../state/automatic/selectors';
import {
  isHybridShape,
  isPromptOnlyShape,
  type MigrationsJsonMetadata,
} from '../migration-shape';

export interface MigrationCardHandle {
  expand: () => void;
  collapse: () => void;
  toggle: () => void;
}

function convertUrlsToLinks(text: string): ReactNode[] {
  const urlRegex = /(https?:\/\/[^\s]+)/g;
  const parts = text.split(urlRegex);
  const urls = text.match(urlRegex) || [];
  const result: ReactNode[] = [];
  for (let i = 0; i < parts.length; i++) {
    if (urls[i - 1]) {
      result.push(
        <a
          key={i}
          rel="noopener noreferrer"
          href={urls[i - 1]}
          target="_blank"
          className="text-blue-500 hover:underline"
        >
          {urls[i - 1]}
        </a>
      );
    } else if (parts[i]) {
      result.push(parts[i]);
    }
  }
  return result;
}

export const MigrationCard = forwardRef<
  MigrationCardHandle,
  {
    actor: Interpreter<
      AutomaticMigrationState,
      any,
      AutomaticMigrationEvents,
      any,
      any
    >;
    migration: MigrationDetailsWithId;
    nxConsoleMetadata: MigrationsJsonMetadata;
    isSelected?: boolean;
    onSelect?: (isSelected: boolean) => void;
    onRunMigration?: () => void;
    onFileClick: (file: Omit<FileChange, 'content'>) => void;
    onViewImplementation: () => void;
    onViewDocumentation: () => void;
    onViewPrompt: () => void;
    isExpanded?: boolean;
  }
>(function MigrationCard(
  {
    actor,
    migration,
    nxConsoleMetadata,
    isSelected,
    onSelect,
    onRunMigration,
    onFileClick,
    onViewImplementation,
    onViewDocumentation,
    onViewPrompt,
    isExpanded: isExpandedProp,
  },
  ref
) {
  const [isExpanded, setIsExpanded] = useState(isExpandedProp ?? false);

  useImperativeHandle(
    ref,
    () => ({
      expand: () => setIsExpanded(true),
      collapse: () => setIsExpanded(false),
      toggle: () => setIsExpanded((prev) => !prev),
    }),
    []
  );

  useEffect(() => {
    if (isExpandedProp !== undefined) {
      setIsExpanded(isExpandedProp);
    }
  }, [isExpandedProp]);

  const migrationResult = nxConsoleMetadata.completedMigrations?.[migration.id];

  const filesChanged =
    migrationResult?.type === 'successful' ? migrationResult.changedFiles : [];

  const nextSteps =
    migrationResult?.type === 'successful' ? migrationResult.nextSteps : [];

  const isPromptOnly = isPromptOnlyShape(migration);
  const isHybrid = isHybridShape(migration);
  const isPromptBearing = isPromptOnly || isHybrid;
  const isSuccessful = migrationResult?.type === 'successful';
  const acknowledgedPrompt =
    isSuccessful && !!migrationResult.acknowledgedPrompt;
  // For terminal non-success states the Failed/Skipped/Stopped pill in the
  // card top-right already conveys the outcome — stay out of the way.
  const showPromptStatusRow =
    isPromptBearing && (!migrationResult || isSuccessful);
  // The prompt-path reminder lives in the next-steps section for every
  // prompt-bearing phase where running the prompt is (or was) actionable:
  // prompt-only from the start, hybrid only once the generator succeeded.
  const showPromptNextStep =
    showPromptStatusRow && (isPromptOnly || isSuccessful) && !!migration.prompt;

  const isSucceeded = useSelector(
    actor,
    (state) => getMigrationType(state.context, migration.id) === 'successful'
  );
  const isFailed = useSelector(
    actor,
    (state) => getMigrationType(state.context, migration.id) === 'failed'
  );
  const isSkipped = useSelector(
    actor,
    (state) => getMigrationType(state.context, migration.id) === 'skipped'
  );
  const isStopped = useSelector(
    actor,
    (state) => getMigrationType(state.context, migration.id) === 'stopped'
  );
  const hasChanges = useSelector(actor, (state) =>
    currentMigrationHasChanges(state.context)
  );
  const isRunning = useSelector(actor, (state) =>
    isMigrationRunning(state.context, migration.id)
  );

  const renderSelectBox = onSelect && isSelected !== undefined;

  const isNxMigration =
    migration.package.startsWith('@nx') || migration.package.startsWith('nx');

  return (
    <div
      key={migration.id}
      className={`gap-2 rounded-md p-2 transition-colors`}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          {renderSelectBox && (
            <div className="h-4 w-4">
              <input
                checked={isSelected}
                onChange={(e) => onSelect((e.target as any).checked)}
                id={migration.id}
                name={migration.id}
                value={migration.id}
                type="checkbox"
                className={`h-4 w-4 ${
                  isSucceeded
                    ? 'accent-green-600 dark:accent-green-500'
                    : isFailed
                      ? 'accent-red-600 dark:accent-red-500'
                      : 'accent-blue-500 dark:accent-sky-500'
                }`}
              />
            </div>
          )}
          <div className={`flex flex-col gap-1`}>
            <div
              className={`flex items-center gap-2 ${
                isNxMigration ? 'cursor-pointer gap-1 hover:underline' : ''
              }`}
              onClick={() => {
                if (isNxMigration) {
                  onViewDocumentation();
                }
              }}
            >
              {/* <div>{migration.name}</div>
              {isNxMigration && (
                <ArrowTopRightOnSquareIcon className="h-4 w-4" />
              )} */}
            </div>
            <span className="mb-2 text-sm">{migration.description}</span>
            <div className="flex items-center gap-2">
              {migration.package && (
                <Pill
                  text={`${migration.package}: ${migration.version}`}
                  color={'grey'}
                />
              )}
              {isPromptBearing && <AIBadge />}
            </div>
            {showPromptStatusRow && (
              <PromptStatusRow
                isHybrid={isHybrid}
                isSuccessful={isSuccessful}
                acknowledgedPrompt={acknowledgedPrompt}
              />
            )}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {' '}
          {isSucceeded && !hasChanges && (
            <Pill text="No changes made" color="green" />
          )}
          {isSucceeded && hasChanges && (
            <div>
              <div
                className="cursor-pointer"
                onClick={() => {
                  setIsExpanded(!isExpanded);
                }}
              >
                <Pill
                  key="changes"
                  text={`${filesChanged.length} changes`}
                  color="green"
                />
              </div>
            </div>
          )}
          {isFailed && (
            <div>
              <Pill text="Failed" color="red" />
            </div>
          )}
          {isSkipped && (
            <div>
              <Pill text="Skipped" color="grey" />
            </div>
          )}
          {isStopped && (
            <div>
              <Pill text="Stopped" color="yellow" />
            </div>
          )}
          {onRunMigration && !isStopped && !isPromptOnly && (
            <span
              className={`rounded-md p-1 text-sm ring-1 transition-colors ring-inset ${
                isSucceeded
                  ? 'bg-green-50 text-green-700 ring-green-200 hover:bg-green-100 dark:bg-green-900/20 dark:text-green-500 dark:ring-green-900/30 dark:hover:bg-green-900/30'
                  : isFailed
                    ? 'bg-red-50 text-red-700 ring-red-200 hover:bg-red-100 dark:bg-red-900/20 dark:text-red-500 dark:ring-red-900/30 dark:hover:bg-red-900/30'
                    : 'bg-inherit text-slate-600 ring-slate-400/40 hover:bg-slate-200 dark:text-slate-300 dark:ring-slate-400/30 dark:hover:bg-slate-700/60'
              }`}
            >
              {isRunning ? (
                <ArrowPathIcon
                  className="h-6 w-6 animate-spin cursor-not-allowed text-blue-500"
                  aria-label="Migration in progress"
                />
              ) : !isSucceeded && !isFailed && !isStopped ? (
                <PlayIcon
                  onClick={onRunMigration}
                  className="h-6 w-6 !cursor-pointer"
                  aria-label="Run migration"
                />
              ) : (
                <ArrowPathIcon
                  onClick={onRunMigration}
                  className="h-6 w-6 !cursor-pointer"
                  aria-label="Rerun migration"
                />
              )}
            </span>
          )}
        </div>
      </div>
      {(isSucceeded && nextSteps?.length) || showPromptNextStep ? (
        <div className="pt-2">
          <div className="my-2 border-t border-slate-200 dark:border-slate-700/60" />
          <span className="pb-2 text-sm font-bold">
            More Information & Next Steps
          </span>
          <ul className="list-inside list-disc pl-2">
            {nextSteps.map((step, idx) => (
              <li key={idx} className="text-sm">
                {convertUrlsToLinks(step)}
              </li>
            ))}
            {showPromptNextStep && (
              <li className="text-sm">
                Run the AI prompt at{' '}
                <code
                  className="cursor-pointer text-sky-500 underline-offset-2 hover:underline dark:text-sky-300"
                  onClick={() => onViewPrompt()}
                >
                  {migration.prompt}
                </code>{' '}
                to complete this migration.
              </li>
            )}
          </ul>
          <p></p>
        </div>
      ) : null}

      <div className="mt-4 flex justify-end gap-2">
        <button
          onClick={() => onViewImplementation()}
          className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
        >
          <CodeBracketIcon className="h-4 w-4" />
          View Source
        </button>
        {isFailed && (
          <button
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <ExclamationCircleIcon className="h-4 w-4" />
            {isExpanded ? 'Hide Errors' : 'View Errors'}
          </button>
        )}
        {isSucceeded && hasChanges && (
          <button
            className="flex items-center gap-2 rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-medium text-slate-700 shadow-xs transition-colors hover:bg-slate-50 dark:border-slate-600 dark:bg-slate-800 dark:text-slate-300 hover:dark:bg-slate-700"
            onClick={() => {
              setIsExpanded(!isExpanded);
            }}
          >
            <ListBulletIcon className="h-4 w-4" />
            {isExpanded ? 'Hide Changes' : 'View Changes'}
          </button>
        )}
      </div>
      <AnimatePresence>
        {isFailed && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: isExpanded ? 'auto' : 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex overflow-hidden pt-2"
          >
            <pre>{(migrationResult as any)?.error}</pre>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isStopped && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: isExpanded ? 'auto' : 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="flex overflow-hidden pt-2"
          >
            <pre>{(migrationResult as any)?.error}</pre>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isSucceeded && hasChanges && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: isExpanded ? 'auto' : 0 }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.3, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="my-2 border-t border-slate-200 dark:border-slate-700/60"></div>
            <span className="pb-2 text-sm font-bold">File Changes</span>
            <ul className="flex flex-col gap-2">
              {filesChanged.map((file) => {
                return (
                  <li
                    className="cursor-pointer text-sm hover:underline"
                    key={`${migration.id}-${file.path}`}
                    onClick={() => {
                      onFileClick(file);
                    }}
                  >
                    <code>{file.path}</code>
                  </li>
                );
              })}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
});

function AIBadge() {
  return (
    <span
      className="inline-flex items-center gap-1 rounded bg-sky-300/10 px-2 py-0.5 text-[10px] font-semibold tracking-wider text-sky-300 uppercase ring-1 ring-sky-300/40 ring-inset"
      aria-label="AI-assisted migration"
    >
      <SparklesIcon className="h-3 w-3" />
      AI
    </span>
  );
}

function PromptStatusRow({
  isHybrid,
  isSuccessful,
  acknowledgedPrompt,
}: {
  isHybrid: boolean;
  isSuccessful: boolean;
  acknowledgedPrompt: boolean;
}) {
  // Prompt-only is "completed" the moment the metadata records success (the
  // short-circuit does that); hybrid needs the separate acknowledgment.
  const isCompleted = isSuccessful && (!isHybrid || acknowledgedPrompt);
  const showGeneratorComplete = isHybrid && isSuccessful && !isCompleted;

  return (
    <div className="mt-3 flex items-center gap-3 text-xs">
      {isCompleted ? (
        <span className="inline-flex items-center gap-1 text-green-500">
          <CheckCircleIcon className="h-3.5 w-3.5" />
          Completed
        </span>
      ) : (
        <>
          {showGeneratorComplete && (
            <>
              <span className="inline-flex items-center gap-1 text-green-500">
                <CheckCircleIcon className="h-3.5 w-3.5" />
                Generator complete
              </span>
              <span className="text-slate-400/60">·</span>
            </>
          )}
          <span className="inline-flex items-center gap-1 text-sky-300">
            <ClockIcon className="h-3.5 w-3.5" />
            AI prompt pending
          </span>
        </>
      )}
    </div>
  );
}
