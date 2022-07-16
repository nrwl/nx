export function CardList({ items }: { items: string }) {
  const parsedItems: { name: string; path: string }[] = JSON.parse(
    decodeURI(items)
  );

  return (
    <div className="not-prose mt-8 grid grid-cols-2 gap-6 lg:grid-cols-2">
      {parsedItems.map((item) => (
        <div
          key={item.name}
          className="relative flex items-start rounded-md border border-slate-200 bg-slate-50/40 p-4 text-sm shadow-sm transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-slate-50 dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800"
        >
          <a href={item.path} title={item.name}>
            <span className="absolute inset-0" aria-hidden="true"></span>
            {item.name}
          </a>
        </div>
      ))}
    </div>
  );
}
