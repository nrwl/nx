import { ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import {
  ArrowPathIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import Textarea from 'react-textarea-autosize';
import { ChatRequestOptions } from 'ai';
import { cx } from '@nx/nx-dev-ui-primitives';

const controlButtonClasses = cx(
  'inline-flex items-center gap-1.5 rounded-md border border-zinc-300 bg-white px-3 py-1.5 text-sm font-medium text-zinc-800 shadow-sm',
  'hover:bg-zinc-50 focus:outline-none focus:ring-2 focus:ring-blue-500',
  'dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800'
);

export function Prompt({
  isGenerating,
  showNewChatCta,
  showRegenerateCta,
  onSubmit,
  onInputChange,
  onNewChat,
  onStopGenerating,
  onRegenerate,
  input,
}: {
  isGenerating: boolean;
  showNewChatCta: boolean;
  showRegenerateCta: boolean;
  onSubmit: (
    e: FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions | undefined
  ) => void;
  onInputChange: (
    e: ChangeEvent<HTMLTextAreaElement> | ChangeEvent<HTMLInputElement>
  ) => void;
  onNewChat: () => void;
  onStopGenerating: () => void;
  onRegenerate: () => void;
  input: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (!isGenerating) inputRef.current?.focus();
  }, [isGenerating]);
  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    if (inputRef.current?.value.trim()) onSubmit(event);
    else event.preventDefault();
  };

  const handleNewChat = () => {
    onNewChat();
    inputRef.current?.focus();
  };

  const handleStopGenerating = () => {
    onStopGenerating();
    inputRef.current?.focus();
  };

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="relative mx-auto flex max-w-3xl gap-2 rounded-md border border-zinc-300 bg-white px-2 py-2 shadow-lg dark:border-zinc-900 dark:bg-zinc-700"
    >
      <div
        className={cx(
          'absolute -top-full left-1/2 mt-1 -translate-x-1/2',
          'flex gap-4'
        )}
      >
        {isGenerating && (
          <button
            type="button"
            className={controlButtonClasses}
            onClick={handleStopGenerating}
          >
            <StopIcon aria-hidden="true" className="h-5 w-5" />
            <span className="text-base">Stop generating</span>
          </button>
        )}
        {showNewChatCta && (
          <button
            type="button"
            className={controlButtonClasses}
            onClick={handleNewChat}
          >
            <XMarkIcon aria-hidden="true" className="h-5 w-5" />
            <span className="text-base">Clear chat</span>
          </button>
        )}
        {showRegenerateCta && (
          <button
            type="button"
            className={controlButtonClasses}
            onClick={onRegenerate}
          >
            <ArrowPathIcon aria-hidden="true" className="h-5 w-5" />
            <span className="text-base">Regenerate</span>
          </button>
        )}
      </div>
      <div className="h-full max-h-[300px] w-full overflow-y-auto">
        <Textarea
          onKeyDown={(event) => {
            if (
              event.key === 'Enter' &&
              !event.shiftKey &&
              !event.nativeEvent.isComposing
            ) {
              formRef.current?.requestSubmit();
              event.preventDefault();
            }
          }}
          ref={inputRef}
          value={input}
          onChange={onInputChange}
          id="query-prompt"
          name="query"
          maxLength={500}
          disabled={isGenerating}
          className="block w-full resize-none border-none bg-transparent p-0 py-3 pl-2 text-sm placeholder-zinc-500 focus-within:outline-none focus:placeholder-zinc-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-white dark:focus:placeholder-zinc-300"
          placeholder="How does caching work?"
          rows={1}
        />
      </div>
      <div className="flex">
        <button
          type="submit"
          disabled={isGenerating}
          className="inline-flex h-12 w-12 items-center justify-center self-end rounded-md bg-zinc-900 text-white hover:bg-zinc-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900 dark:hover:bg-zinc-100"
        >
          <span className="sr-only">Ask</span>
          <PaperAirplaneIcon aria-hidden="true" className="h-5 w-5" />
        </button>
      </div>
    </form>
  );
}
