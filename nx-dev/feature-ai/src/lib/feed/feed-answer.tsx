import {
  HandThumbDownIcon,
  HandThumbUpIcon,
} from '@heroicons/react/24/outline';
import { cx } from '@nx/nx-dev/ui-primitives';
import { useMemo, useState } from 'react';
import { ChatGptLogo } from './chat-gpt-logo';
import { renderMarkdown } from '@nx/nx-dev/ui-markdoc';

// Exported for tests
export function normalizeContent(content: string): string {
  return (
    content
      // Prevents accidentally triggering numbered list.
      .replace(/\n(\d)\./g, '\n$1\\.')
      // The AI is prompted to replace relative links with absolute links (https://nx.dev/<path>).
      // However, our docs renderer will prefix img src with `/documentation`, so we need to convert image links back to relative paths.
      .replace(/\(https:\/\/nx.dev\/(.+?\.(png|svg|jpg|webp))\)/, '(/$1)')
  );
}

export function FeedAnswer({
  content,
  feedbackButtonCallback,
  isFirst,
}: {
  content: string;
  feedbackButtonCallback: (value: 'bad' | 'good') => void;
  isFirst: boolean;
}) {
  const callout = useMemo(
    () =>
      renderMarkdown(
        `{% callout type="warning" title="Always double-check!" %}The results may not be accurate, so please always double check with our documentation.{% /callout %}\n`,
        { filePath: '' }
      ).node,
    []
  );
  const [feedbackStatement, setFeedbackStatement] = useState<
    'bad' | 'good' | null
  >(null);

  function handleFeedbackButtonClicked(statement: 'bad' | 'good'): void {
    if (!!feedbackStatement) return;

    setFeedbackStatement(statement);
    feedbackButtonCallback(statement);
  }

  const normalizedContent = normalizeContent(content);

  return (
    <>
      <div className="grid h-12 w-12 items-center justify-center rounded-full bg-white text-slate-900 ring-1 ring-slate-200 dark:bg-slate-900 dark:text-white dark:ring-slate-700">
        <svg
          role="img"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
          className="h-8 w-8"
          fill="currentColor"
        >
          <title>Nx</title>
          <path d="M11.987 14.138l-3.132 4.923-5.193-8.427-.012 8.822H0V4.544h3.691l5.247 8.833.005-3.998 3.044 4.759zm.601-5.761c.024-.048 0-3.784.008-3.833h-3.65c.002.059-.005 3.776-.003 3.833h3.645zm5.634 4.134a2.061 2.061 0 0 0-1.969 1.336 1.963 1.963 0 0 1 2.343-.739c.396.161.917.422 1.33.283a2.1 2.1 0 0 0-1.704-.88zm3.39 1.061c-.375-.13-.8-.277-1.109-.681-.06-.08-.116-.17-.176-.265a2.143 2.143 0 0 0-.533-.642c-.294-.216-.68-.322-1.18-.322a2.482 2.482 0 0 0-2.294 1.536 2.325 2.325 0 0 1 4.002.388.75.75 0 0 0 .836.334c.493-.105.46.36 1.203.518v-.133c-.003-.446-.246-.55-.75-.733zm2.024 1.266a.723.723 0 0 0 .347-.638c-.01-2.957-2.41-5.487-5.37-5.487a5.364 5.364 0 0 0-4.487 2.418c-.01-.026-1.522-2.39-1.538-2.418H8.943l3.463 5.423-3.379 5.32h3.54l1.54-2.366 1.568 2.366h3.541l-3.21-5.052a.7.7 0 0 1-.084-.32 2.69 2.69 0 0 1 2.69-2.691h.001c1.488 0 1.736.89 2.057 1.308.634.826 1.9.464 1.9 1.541a.707.707 0 0 0 1.066.596zm.35.133c-.173.372-.56.338-.755.639-.176.271.114.412.114.412s.337.156.538-.311c.104-.231.14-.488.103-.74z" />
        </svg>
      </div>
      <div className="min-w-0 flex-1">
        <div>
          <div className="flex items-center gap-2 text-lg text-slate-900 dark:text-slate-100">
            Nx Assistant
          </div>
          <p className="mt-0.5 flex items-center gap-x-1 text-sm text-slate-500">
            <ChatGptLogo
              className="h-4 w-4 text-slate-400"
              aria-hidden="true"
            />{' '}
            AI powered
          </p>
        </div>
        <div className="prose prose-slate dark:prose-invert mt-2 w-full max-w-none 2xl:max-w-4xl">
          {!isFirst && callout}
          {renderMarkdown(normalizedContent, { filePath: '' }).node}
        </div>
        {!isFirst && (
          <div className="text-md group flex-1 gap-4 text-slate-400 transition hover:text-slate-500 md:flex md:items-center md:justify-end">
            {feedbackStatement ? (
              <p className="italic group-hover:flex">
                {feedbackStatement === 'good'
                  ? 'Glad I could help!'
                  : 'Sorry, could you please rephrase your question?'}
              </p>
            ) : (
              <p className="hidden italic group-hover:flex">
                Is that the answer you were looking for?
              </p>
            )}
            <div className="flex gap-4">
              <button
                className={cx(
                  'p-1 transition-all hover:rotate-12 hover:text-blue-500 disabled:cursor-not-allowed dark:hover:text-sky-500',
                  { 'text-blue-500': feedbackStatement === 'bad' }
                )}
                disabled={!!feedbackStatement}
                onClick={() => handleFeedbackButtonClicked('bad')}
                title="Bad"
              >
                <span className="sr-only">Bad answer</span>
                <HandThumbDownIcon className="h-6 w-6" aria-hidden="true" />
              </button>
              <button
                className={cx(
                  'p-1 transition-all hover:rotate-12 hover:text-blue-500 disabled:cursor-not-allowed dark:hover:text-sky-500',
                  { 'text-blue-500': feedbackStatement === 'good' }
                )}
                disabled={!!feedbackStatement}
                onClick={() => handleFeedbackButtonClicked('good')}
                title="Good"
              >
                <span className="sr-only">Good answer</span>
                <HandThumbUpIcon className="h-6 w-6" aria-hidden="true" />
              </button>
            </div>
          </div>
        )}
      </div>
    </>
  );
}
