import { PaperAirplaneIcon } from '@heroicons/react/24/outline';
import { Button } from '@nx/nx-dev/ui-common';

export function Prompt({
  isDisabled,
  handleSubmit,
}: {
  isDisabled: boolean;
  handleSubmit: (query: string) => void;
}) {
  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSubmit((event.target as any).query.value);
        event.currentTarget.reset();
      }}
      className="relative flex gap-4 max-w-xl mx-auto py-2 px-4 shadow-lg rounded-md border border-slate-300 bg-white dark:border-slate-900 dark:bg-slate-700"
    >
      <input
        id="query-prompt"
        name="query"
        disabled={isDisabled}
        className="p-0 flex flex-grow text-sm placeholder-slate-500 transition bg-transparent focus:placeholder-slate-400 dark:focus:placeholder-slate-300 dark:text-white focus:outline-none focus:ring-0 border-none disabled:cursor-not-allowed"
        placeholder="How does caching work?"
        type="text"
      />
      <Button
        variant="primary"
        size="small"
        type="submit"
        disabled={isDisabled}
        className="disabled:cursor-not-allowed"
      >
        <div hidden className="sr-only">
          Ask
        </div>
        <PaperAirplaneIcon aria-hidden="true" className="h-5 w-5" />
      </Button>
    </form>
  );
}
