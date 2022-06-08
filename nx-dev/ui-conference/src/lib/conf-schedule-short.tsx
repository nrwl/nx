interface ScheduleItem {
  description: string;
  speakers: Array<string>;
  time: string;
  title: string;
  type: 'event' | 'break';
  videoUrl?: string;
}

export function ConfScheduleShort(): JSX.Element {
  const scheduleItemsFor16: ScheduleItem[] = [
    {
      type: 'event',
      time: '12:00 - 12:30 pm ET',
      title: 'Keynote',
      description: '',
      speakers: ['Juri Strumpflohner', 'Victor Savkin'],
      videoUrl: 'https://www.youtube.com/watch?v=vLOKgg05Az0',
    },
    {
      type: 'event',
      time: '12:30 - 1:00pm ET',
      title: 'Understanding Monorepos: What you need to know',
      description:
        'Monorepos are hot right now, especially among Web developers. We’re here to help you understand what they are, what problems they solve, and how Nx makes them delightful. You can break down barriers and reclaim the collaboration you’ve been missing.',
      speakers: ['Benjamin Cabanes', 'Philip Fulcher'],
      videoUrl: 'https://www.youtube.com/watch?v=pXw9Ugx_YWI',
    },
    {
      type: 'event',
      time: '1:00 - 1:30pm ET',
      title: 'Build your own Nx Workspace from Scratch',
      description:
        "Nx Plugins are opinionated and generate quite a bit of configuration. But what happens when that doesn't suit your organization? What is actually necessary and what can be altered? To understand the core of Nx and how to configure it exactly to your needs, Jason Jean and Miroslav Jonas will be building an Nx Workspace from scratch!",
      speakers: ['Jason Jean', 'Miroslav Jonas'],
      videoUrl: 'https://www.youtube.com/watch?v=0WADb34Yjmg',
    },
    {
      type: 'event',
      time: '1:30 - 1:45pm ET',
      title: 'Speaker Q&A',
      description: '',
      speakers: ['Jason Jean', 'Benjamin Cabanes', 'Philip Fulcher'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '1:45 - 2:15pm ET',
      title: 'Superpowered Micro Frontends with Monorepos',
      description:
        'Micro Frontends are awesome, but they can be difficult to set up, maintain and scale. Learn how Nx and Monorepos not only embrace Micro Frontends, but provide amazing benefits that improves reliability, developer experience and maintainability and also encourages strategic collaboration while reducing the risk of running into classic Micro Frontend problems such as Micro Frontend anarchy, framework version mismatch and out-of-sync shared packages.',
      speakers: ['Colum Ferry'],
      videoUrl: 'https://www.youtube.com/watch?v=dotA6ZSmNL4',
    },
    {
      type: 'event',
      time: '2:15 - 2:45pm ET',
      title: 'Progressively enhance your DX with Nx',
      description:
        'Nx gives you tools to level up your productivity and DX. You can start off with a minimal setup and progressively add features by using plugins. Learn how Nx can help projects of any size to thrive.',
      speakers: ['Craigory Coppola'],
      videoUrl: 'https://www.youtube.com/watch?v=FKSxIJyB508',
    },
    {
      type: 'event',
      time: '2:45 - 3:15pm ET',
      title: 'Into the (Nx) Clouds',
      description:
        "Let's takeoff and create a new monorepo from scratch. We can circle the tools that make your local developer experience more pleasant and cruise over the basic CI configuration you'll need. Then we'll kick in the afterburners and show you what Nx Cloud can really do, how to use some of the lesser known features and how it makes CI even faster with cloud caching and distributed task execution.",
      speakers: ['Jo Hanna Pearce'],
      videoUrl: 'https://www.youtube.com/watch?v=CTdaNk9Pn9g',
    },
    {
      type: 'event',
      time: '3:15 - 3:30pm ET',
      title: 'Speaker Q&A',
      description: '',
      speakers: ['Colum Ferry', 'Craigory Coppola', 'Jo Hanna Pearce'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '3:30 - 3:45pm ET',
      title: 'Nx / NxCloud team panel discussion',
      description:
        'A Q&A panel with Nx and NxCloud teams ready to answer all your burning questions!',
      speakers: ['Nx / NxCloud teams'],
      videoUrl: '',
    },
  ];

  return (
    <div className="border-t border-gray-600">
      <div className="mx-auto max-w-screen-lg text-white xl:max-w-screen-xl">
        <div className="date-container-l font-input-mono grid grid-cols-1 divide-x divide-gray-600">
          <div className="p-8 text-center">April 29th</div>
        </div>
      </div>
      <section className="w-full divide-y divide-gray-600 border-t border-b border-gray-600">
        {scheduleItemsFor16.map((item) =>
          item.type === 'event' ? scheduleRow(item) : breakRow(item)
        )}
      </section>
    </div>
  );
}

const scheduleRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="mx-auto max-w-screen-lg text-white xl:max-w-screen-xl">
      <article className="grid w-full grid-cols-1 md:grid-cols-5 md:divide-x md:divide-gray-600">
        <div className="font-input-mono px-5 pt-12 pb-8 md:py-12">
          <span className="hidden md:block">{item.time}</span>
          <span className="bg-blue-nx-dark mb-4 rounded-md py-4 px-6 md:hidden">
            {item.time}
          </span>
        </div>
        <div className="font-input-mono col-span-2 px-5 md:py-12 md:px-8">
          {item.videoUrl ? (
            <h3 className="mb-4 underline">
              <a href={item.videoUrl} target="_blank" rel="noreferrer">
                {item.title}
              </a>
            </h3>
          ) : (
            <h3 className="mb-4">{item.title}</h3>
          )}
          <div className="text-sm text-gray-400">
            {item.speakers.join(' & ')}
          </div>
        </div>
        <p className="col-span-2 px-5 pt-8 pb-12 text-gray-400 md:py-12 md:px-8">
          {item.description}
        </p>
      </article>
    </div>
  </div>
);

const breakRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="mx-auto max-w-screen-lg text-white xl:max-w-screen-xl">
      <div className="grid w-full grid-cols-1 md:grid-cols-5">
        <div className="font-input-mono px-5 pt-12 pb-8 md:py-12">
          <span className="hidden md:block">{item.time}</span>
          <span className="bg-blue-nx-dark mb-4 rounded-md py-4 px-6 md:hidden">
            {item.time}
          </span>
        </div>
        <div className="px-5 pb-12 md:col-span-4 md:border-l md:border-gray-600 md:py-12 md:px-8">
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
