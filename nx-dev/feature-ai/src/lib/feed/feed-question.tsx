export function FeedQuestion({ content }: { content: string }) {
  return (
    <div className="flex justify-end w-full">
      <p className="px-4 py-2 bg-blue-500 dark:bg-sky-500 selection:bg-sky-900 rounded-lg text-white text-base whitespace-pre-wrap break-words">
        {content}
      </p>
    </div>
  );
}
