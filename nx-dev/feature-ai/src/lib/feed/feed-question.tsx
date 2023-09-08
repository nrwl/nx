export function FeedQuestion({ content }: { content: string }) {
  return (
    <div className="flex justify-end w-full">
      <p className="px-4 py-2 bg-blue-500 dark:bg-sky-500 rounded-full rounded-br-none text-white text-base">
        {content}
      </p>
    </div>
  );
}
