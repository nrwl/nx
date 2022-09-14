export function CardList({ items }: { items: string }) {
  const parsedItems: { name: string; path: string }[] = JSON.parse(
    decodeURI(items)
  );

  return (
    <div className="not-prose mt-8 grid grid-cols-2 gap-6 lg:grid-cols-2">
      {parsedItems.map((item) => (
        <div
          key={item.name}
          className="relative rounded-md border border-slate-100 bg-slate-50 p-4 shadow transition hover:bg-slate-100"
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
