import { FC } from 'react';

export const Partner: FC<{
  name: string;
  logo: React.ReactNode;
  href: string;
  location: string;
  tagline: string;
  capabilities: string[];
}> = ({ name, logo, href, location, tagline, capabilities }) => {
  return (
    <a
      rel="noreferrer"
      href={href}
      target="_blank"
      className={
        'group flex flex-col items-center justify-center border shadow-md transition' +
        ' border-slate-400/50 bg-white hover:border-slate-800/50 hover:bg-slate-200/50 hover:text-slate-950' +
        ' dark:border-slate-400/20 dark:bg-slate-950 dark:hover:border-slate-100/20 dark:hover:bg-slate-950/50 dark:hover:text-white'
      }
    >
      <div className="flex h-[130px] w-full items-center justify-center border-b border-slate-400/20 bg-white p-12 pb-4 pt-8 group-hover:bg-white/20 dark:bg-slate-200 dark:group-hover:bg-slate-50">
        {logo}
      </div>
      <div className="flex-grow p-8">
        <div className="mb-4">
          <strong>{name}</strong>
          <p className="block min-h-14 text-sm text-slate-500">{tagline}</p>
          <div className="my-2 text-sm text-slate-500">({location})</div>
        </div>
        <div>
          {capabilities.map((capability) => (
            <span
              key={capability}
              className={
                'm-1 inline-block whitespace-nowrap rounded-md px-2 py-1 text-xs font-medium ring-1 ring-inset ' +
                'bg-blue-50 text-blue-600 ring-blue-500/10' +
                ' dark:bg-blue-950 dark:text-blue-300 dark:ring-blue-300/10'
              }
            >
              {capability}
            </span>
          ))}
        </div>
      </div>
    </a>
  );
};
