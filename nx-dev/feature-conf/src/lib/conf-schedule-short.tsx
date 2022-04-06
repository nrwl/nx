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
      time: '',
      title: 'Keynote',
      description: '',
      speakers: ['Jeff Cross', 'Victor Savkin'],
      videoUrl: '',
    },
    // {
    //   type: 'break',
    //   time: '10:45-11am',
    //   title: 'Break',
    //   description: '',
    //   speakers: [],
    // },
    {
      type: 'event',
      time: '',
      title: 'Understanding Monorepos: What you need to know',
      description:
        'Monorepos are hot right now, especially among Web developers. We’re here to help you understand what they are, what problems they solve, and how Nx makes them delightful. You can break down barriers and reclaim the collaboration you’ve been missing.',
      speakers: ['Benjamin Cabanes', 'Philip Fulcher'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '',
      title: 'Superpowered Micro Frontends with Monorepos',
      description:
        'Micro Frontends are awesome, but they can be difficult to set up, maintain and scale. Learn how Nx and Monorepos not only embrace Mirco Frontends, but provide amazing benefits that improves reliability, developer experience and maintainability and also encourages strategic collaboration while reducing the risk of running into classic Micro Frontend problems such as Micro Frontend anarchy, framework version mismatch and out-of-sync shared packages.',
      speakers: ['Colum Ferry'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '',
      title: 'Progressively enhance your DX with Nx',
      description:
        'Nx gives you tools to level up your productivity and DX. You can start off with a minimal setup and progressively add features by using plugins. Learn how Nx can help projects of any size to thrive.',
      speakers: ['Craigory Coppola'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '',
      title: 'Into the (Nx) Clouds',
      description:
        "Let's takeoff and create a new monorepo from scratch. We can circle the tools that make your local developer experience more pleasant and cruise over the basic CI configuration you'll need. Then we'll kick in the afterburners and show you what Nx Cloud can really do, how to use some of the lesser known features and how it makes CI even faster with cloud caching and distributed task execution.",
      speakers: ['Jo Hanna Pearce'],
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
              <a href={item.videoUrl} target="_blank">
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
              <a href={item.videoUrl} target="_blank">
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
