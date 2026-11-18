export function FeedQuestion({ content }: { content: string }) {
  return (
    <div className="flex w-full justify-end">
      <p className="rounded-lg bg-blue-500 px-4 py-2 text-base break-words whitespace-pre-wrap text-white selection:bg-blue-900 dark:bg-blue-500">
        {content}
      </p>
    </div>
  );
}
