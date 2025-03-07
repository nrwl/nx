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

const CustomerIconGrid: FC<CustomerIconGridProps> = ({ icons }) => {
  return (
    <div className="grid grid-cols-2 justify-between md:grid-cols-4">
      {icons.map((customerIcon, index) => {
        return (
          <a
            key={`customer-icon-${index}`}
            href={customerIcon.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center border-slate-200/20 p-12 shadow-[0_0px_1px_0_rgba(226,232,240,0.2)] transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white`}
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
