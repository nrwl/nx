export interface ScheduleItem {
  description: string;
  speakers: Array<string>;
  time: string;
  title: string;
  type: 'event' | 'break';
  videoUrl?: string;
}

export const scheduleRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
      <article className="grid w-full grid-cols-1 md:grid-cols-5 md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
        <div className="font-input-mono px-5 pb-8 pt-12 md:py-12">
          <span className="hidden md:block">{item.time}</span>
          <span className="mb-4 rounded-md px-6 py-4 md:hidden">
            {item.time}
          </span>
        </div>
        <div className="font-input-mono col-span-2 px-5 md:px-8 md:py-12">
          {item.videoUrl ? (
            <h3 className="mb-4 underline">
              <a href={item.videoUrl} target="_blank" rel="noreferrer">
                {item.title}
              </a>
            </h3>
          ) : (
            <h3 className="mb-4">{item.title}</h3>
          )}
          <div className="text-sm">{item.speakers.join(' & ')}</div>
        </div>
        <p className="col-span-2 px-5 pb-12 pt-8 md:px-8 md:py-12">
          {item.description}
        </p>
      </article>
    </div>
  </div>
);
export const breakRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
      <div className="grid w-full grid-cols-1 md:grid-cols-5">
        <div className="font-input-mono px-5 pb-8 pt-12 md:py-12">
          <span className="hidden md:block">{item.time}</span>
          <span className="mb-4 rounded-md px-6 py-4 md:hidden">
            {item.time}
          </span>
        </div>
        <div className="px-5 pb-12 md:col-span-4 md:border-l md:border-slate-200 md:px-8 md:py-12 md:dark:border-slate-700">
          {item.videoUrl ? (
            <h3 className="font-input-mono underline">
              <a href={item.videoUrl} target="_blank" rel="noreferrer">
                {item.title}
              </a>
            </h3>
          ) : (
            <h3 className="font-input-mono">{item.title}</h3>
          )}
          <div className="description">{item.description}</div>
        </div>
      </div>
    </div>
  </div>
);
