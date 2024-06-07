import { ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import {
  ArrowPathIcon,
  PaperAirplaneIcon,
  XMarkIcon,
  PlusIcon,
  StopIcon,
} from '@heroicons/react/24/outline';
import { Button } from '@nx/nx-dev/ui-common';
import Textarea from 'react-textarea-autosize';
import { ChatRequestOptions } from 'ai';
import { cx } from '@nx/nx-dev/ui-primitives';

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
      className="relative mx-auto flex max-w-3xl gap-2 rounded-md border border-slate-300 bg-white px-2 py-0 shadow-lg dark:border-slate-900 dark:bg-slate-700"
    >
      <div
        className={cx(
          'absolute -top-full left-1/2 mt-1 -translate-x-1/2',
          'flex gap-4'
        )}
      >
        {isGenerating && (
          <Button
            variant="secondary"
            size="small"
            className={cx('bg-white dark:bg-slate-900')}
            onClick={handleStopGenerating}
          >
            <StopIcon aria-hidden="true" className="h-5 w-5" />
            <span className="text-base">Stop generating</span>
          </Button>
        )}
        {showNewChatCta && (
          <Button
            variant="secondary"
            size="small"
            className={cx('bg-white dark:bg-slate-900')}
            onClick={handleNewChat}
          >
            <XMarkIcon aria-hidden="true" className="h-5 w-5" />
            <span className="text-base">Clear chat</span>
          </Button>
        )}
        {showRegenerateCta && (
          <Button
            variant="secondary"
            size="small"
            className={cx('bg-white dark:bg-slate-900')}
            onClick={onRegenerate}
          >
            <ArrowPathIcon aria-hidden="true" className="h-5 w-5" />
            <span className="text-base">Regenerate</span>
          </Button>
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
          className="block w-full resize-none border-none bg-transparent p-0 py-[1.3rem] pl-2 text-sm placeholder-slate-500 focus-within:outline-none focus:placeholder-slate-400 focus:outline-none focus:ring-0 disabled:cursor-not-allowed dark:text-white dark:focus:placeholder-slate-300"
          placeholder="How does caching work?"
          rows={1}
        />
      </div>
      <div className="flex pb-2">
        <Button
          variant="primary"
          size="small"
          type="submit"
          disabled={isGenerating}
          className="h-12 w-12 self-end disabled:cursor-not-allowed"
        >
          <div hidden className="sr-only">
            Ask
          </div>
          <PaperAirplaneIcon aria-hidden="true" className="h-5 w-5" />
        </Button>
      </div>
    </form>
  );
}
