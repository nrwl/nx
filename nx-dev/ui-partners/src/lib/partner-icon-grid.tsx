import { FC, SVGProps } from 'react';

interface PartnerIcon {
  url: string;
  icon: FC<SVGProps<SVGSVGElement>>;
  height: string;
  width: string;
}

interface PartnerIconGridProps {
  icons: PartnerIcon[];
}

const PartnerIconGrid: FC<PartnerIconGridProps> = ({ icons }) => {
  return (
    <div className="grid grid-cols-2 justify-between md:grid-cols-4">
      {icons.map((partnerIcon, index) => {
        return (
          <a
            key={`partner-icon-${index}`}
            href={partnerIcon.url}
            target="_blank"
            rel="noopener noreferrer"
            className={`flex items-center justify-center border-slate-200/20 p-12 shadow-[0_0px_1px_0_rgba(226,232,240,0.2)] transition hover:bg-slate-100/20 hover:text-slate-950 dark:border-slate-800/20 dark:hover:border-slate-600/20 dark:hover:bg-slate-600/10 dark:hover:text-white`}
          >
            <partnerIcon.icon
              aria-hidden="true"
              className={`${partnerIcon.height} ${partnerIcon.width}`}
            />
          </a>
        );
      })}
    </div>
  );
};

export default PartnerIconGrid;
export { PartnerIconGrid, type PartnerIcon };
