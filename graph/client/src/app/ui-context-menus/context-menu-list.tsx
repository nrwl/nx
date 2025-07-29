import classNames from 'classnames';

interface ContextMenuListSection {
  label: string;
  items: string[];
}

export function ContextMenuList({
  sections,
  className,
}: {
  sections: ContextMenuListSection[] | ContextMenuListSection;
  className?: string;
}) {
  const normalizedSections = Array.isArray(sections) ? sections : [sections];
  const hasItems = normalizedSections.some((section) => section.items.length > 0);
  
  if (!hasItems) return null;

  const isMultiSection = normalizedSections.length > 1;

  return (
    <div
      className={classNames(
        'rounded-md border border-slate-200 dark:border-slate-800',
        {
          'max-h-[432px] overflow-auto': isMultiSection,
          'overflow-hidden': !isMultiSection,
        },
        className
      )}
    >
      {isMultiSection ? (
        <div className="flex flex-col gap-2">
          {normalizedSections.map((section) => (
            <ListSection key={section.label} {...section} />
          ))}
        </div>
      ) : (
        <ListSection {...normalizedSections[0]} />
      )}
    </div>
  );
}

function ListSection({ label, items }: ContextMenuListSection) {
  if (items.length === 0) return null;

  return (
    <div>
      <div className="bg-slate-50 px-4 py-2 text-xs font-medium uppercase text-slate-500 dark:bg-slate-800 dark:text-slate-400">
        <span>{label}</span>
      </div>
      <ul className="divide-y divide-slate-200 dark:divide-slate-800">
        {items.map((item) => (
          <li
            key={item}
            className="whitespace-nowrap px-4 py-2 text-sm font-medium text-slate-800 dark:text-slate-300"
          >
            <span className="block truncate font-normal">{item}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

