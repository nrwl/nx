import { ChangeEvent, FormEvent, useEffect, useRef } from 'react';
import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Button } from '@nx/nx-dev/ui-common';
import Textarea from 'react-textarea-autosize';
import { ChatRequestOptions } from 'ai';

export function Prompt({
  isDisabled,
  handleSubmit,
  handleInputChange,
  input,
}: {
  isDisabled: boolean;
  handleSubmit: (
    e: FormEvent<HTMLFormElement>,
    chatRequestOptions?: ChatRequestOptions | undefined
  ) => void;
  handleInputChange: (
    e: ChangeEvent<HTMLTextAreaElement> | ChangeEvent<HTMLInputElement>
  ) => void;
  input: string;
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus();
    }
  }, []);

  return (
    <form
      ref={formRef}
      onSubmit={handleSubmit}
      className="relative mx-auto flex max-w-2xl gap-2 rounded-md border border-slate-300 bg-white py-0 px-2 shadow-lg dark:border-slate-900 dark:bg-slate-700"
    >
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
          onChange={handleInputChange}
          id="query-prompt"
          name="query"
          disabled={isDisabled}
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
          disabled={isDisabled}
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
