import { FC } from 'react';

export const Partner: FC<{
  name: string;
  logo: React.ReactNode;
  href: string;
}> = ({ name, logo, href }) => {
  return (
    <a
      rel="noreferrer"
      href={href}
      target="_blank"
      className={
        'flex flex-col items-center justify-center border p-12 shadow-md transition' +
        ' border-slate-400/50 bg-white hover:border-slate-800/50 hover:bg-slate-200/50 hover:text-slate-950' +
        ' dark:border-slate-400/20 dark:bg-slate-950 dark:hover:border-slate-100/20 dark:hover:bg-slate-950/50 dark:hover:text-white'
      }
    >
      {logo}
      {name}
    </a>
  );
};
