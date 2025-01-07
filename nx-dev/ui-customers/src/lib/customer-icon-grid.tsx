import { FC, SVGProps } from 'react';

interface CustomerIcon {
  url: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  height: string;
  width: string;
}

interface CustomerIconGridProps {
  icons: CustomerIcon[];
}

// Helper function to determine border class based on the index and total number of icons
function getBorderClass(index: number, totalIcons: number, columns = 4) {
  const isFirstRow = index < columns;
  const isLastRow = index >= totalIcons - columns;

  // First Row
  if (isFirstRow) {
    if (index % columns === 0) return 'border'; // 1st item
    if ((index + 1) % columns === 0) return 'border-y border-r'; // 4th item
    return index % 2 === 0 ? 'border' : 'border-y'; // 2nd and 3rd items
  }

  // Last Row
  if (isLastRow) {
    if (index % columns === 0) return 'border-x border-b'; // 1st item
    if ((index + 1) % columns === 0) return 'border-b border-r'; // 4th item
    return index % 2 === 0 ? 'border-x border-b' : 'border-b'; // 2nd and 3rd items
  }

  // Middle Rows
  if (index % columns === 0) return 'border-x border-b'; // 1st item
  if ((index + 1) % columns === 0) return 'border-r border-b'; // 4th item
  return index % 2 === 0 ? 'border-x border-b' : 'border-b'; // 2nd and 3rd items
}

const CustomerIconGrid: FC<CustomerIconGridProps> = ({ icons }) => {
  return (
    <div className="grid grid-cols-2 justify-between md:grid-cols-4">
      {icons.map((customerIcon, index) => {
        const borderClass = getBorderClass(index, icons.length);

        return (
          <a
            key={`customer-icon-${index}`}
            href={customerIcon.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center border-slate-200/20 ${borderClass} p-12 transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white`}
          >
            <customerIcon.icon
              aria-hidden="true"
              className={`${customerIcon.height} ${customerIcon.width}`}
            />
          </a>
        );
      })}
    </div>
  );
};

export default CustomerIconGrid;
export { CustomerIconGrid, type CustomerIcon };
