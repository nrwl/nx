export function FeedQuestion({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-end">
      <p className="whitespace-pre-wrap break-words rounded-lg bg-blue-500 px-4 py-2 text-base text-white selection:bg-sky-900 dark:bg-sky-500">
        {content}
      </p>
    </div>
  );
}
