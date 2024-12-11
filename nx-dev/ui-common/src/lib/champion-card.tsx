import { ChatBubbleLeftIcon, MapIcon } from '@heroicons/react/24/solid';

interface ContactDetails {
  label: string;
  link: string;
}

export interface Champion {
  name: string;
  location: string;
  expertise: string;
  imageUrl: string;
  contact: ContactDetails[];
}

export function ChampionCard({ data }: { data: Champion }): JSX.Element {
  return (
    <figure className="relative flex flex-col justify-between rounded-lg border border-slate-200 bg-white/40 p-4 text-sm shadow-sm  transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800">
      <figcaption className="flex items-center space-x-4">
        <img
          src={data.imageUrl}
          alt={data.name}
          className="h-12 w-12 flex-none rounded-full border border-slate-200 bg-slate-800/40 object-cover dark:border-slate-800/40 dark:bg-slate-200"
          loading="lazy"
        />
        <div className="flex-auto">
          <div className="font-semibold text-slate-500 dark:text-slate-300">
            <a target="_blank" rel="noreferrer" href={data.contact[0].link}>
              <span className="absolute inset-0"></span>
              {data.name}
            </a>
          </div>
          <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            <MapIcon className="inline h-4 w-4" /> {data.location}
          </div>
        </div>
      </figcaption>
      <p className="mt-4">{data.expertise}</p>
      <div className="ml mt-4 inline text-xs text-slate-400 dark:text-slate-500">
        <ChatBubbleLeftIcon className="inline h-4 w-4" />{' '}
        {data.contact[0].label}
      </div>
    </figure>
  );
}
