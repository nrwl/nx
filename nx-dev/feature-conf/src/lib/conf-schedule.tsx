interface ScheduleItem {
  description: string;
  speakers: Array<string>;
  time: string;
  title: string;
  type: 'event' | 'break';
}

export function ConfSchedule(): JSX.Element {
  const scheduleItemsFor16: ScheduleItem[] = [
    {
      type: 'event',
      time: '10-10:45am',
      title: 'Keynote - Setup Next.js to use Tailwind with Nx',
      description:
        'This article is a part of a series around building a blog with Nx, Next.js, Tailwing, Storybook and Cypress. In the previous article we learned how to set up Next.js in an Nx workspace. In this article, we carry that forward, by adding Tailwing CSS support to our setup.',
      speakers: ['Jeff Cross / Nrwl', 'Victor Savkin / Nrwl'],
    },
    {
      type: 'break',
      time: '10:45-11am',
      title: 'Break',
      description: '',
      speakers: [],
    },
    {
      type: 'event',
      time: '10-10:45am',
      title: 'Keynote - Setup Next.js to use Tailwind with Nx',
      description:
        'This article is a part of a series around building a blog with Nx, Next.js, Tailwing, Storybook and Cypress. In the previous article we learned how to set up Next.js in an Nx workspace. In this article, we carry that forward, by adding Tailwing CSS support to our setup.',
      speakers: ['Jeff Cross / Nrwl', 'Victor Savkin / Nrwl'],
    },
  ];
  const scheduleItemsFor17: ScheduleItem[] = [
    {
      type: 'event',
      time: '10-10:45am',
      title: 'Keynote - Setup Next.js to use Tailwind with Nx',
      description:
        'This article is a part of a series around building a blog with Nx, Next.js, Tailwing, Storybook and Cypress. In the previous article we learned how to set up Next.js in an Nx workspace. In this article, we carry that forward, by adding Tailwing CSS support to our setup.',
      speakers: ['Jeff Cross / Nrwl', 'Victor Savkin / Nrwl'],
    },
    {
      type: 'break',
      time: '10:45-11am',
      title: 'Break',
      description: '',
      speakers: [],
    },
    {
      type: 'event',
      time: '10-10:45am',
      title: 'Keynote - Setup Next.js to use Tailwind with Nx',
      description:
        'This article is a part of a series around building a blog with Nx, Next.js, Tailwing, Storybook and Cypress. In the previous article we learned how to set up Next.js in an Nx workspace. In this article, we carry that forward, by adding Tailwing CSS support to our setup.',
      speakers: ['Jeff Cross / Nrwl', 'Victor Savkin / Nrwl'],
    },
  ];

  return (
    <div className="border border-r-0 border-l-0 border-gray-600">
      <div className="grid grid-cols-2 border border-t-0 border-gray-600 font-input-mono divide-x divide-gray-600">
        <div className="p-8 text-center bg-blue-nx-dark">September 16</div>
        <div className="p-8 text-center">September 17</div>
      </div>
      <section className="w-full divide-y divide-gray-600">
        {scheduleItemsFor16.map((item) =>
          item.type === 'event' ? scheduleRow(item) : breakRow(item)
        )}
      </section>
      <div className="grid grid-cols-2 border border-gray-600 font-input-mono divide-x divide-gray-600">
        <div className="p-8 text-center">September 16</div>
        <div className="p-8 text-center bg-blue-nx-dark">September 17</div>
      </div>
      <section className="w-full divide-y divide-gray-600">
        {scheduleItemsFor17.map((item) =>
          item.type === 'event' ? scheduleRow(item) : breakRow(item)
        )}
      </section>
    </div>
  );
}

const scheduleRow = (item: ScheduleItem): JSX.Element => (
  <article key={item.title} className="w-full grid grid-cols-1 md:grid-cols-5">
    <div className="pt-12 pb-8 md:py-12 font-input-mono">
      <span className="hidden md:block">{item.time}</span>
      <span className="py-4 px-6 mb-4 bg-blue-nx-dark rounded-md md:hidden">
        {item.time}
      </span>
    </div>
    <div className="md:py-12 md:px-8 col-span-2 md:border md:border-t-0 md:border-b-0 md:border-gray-600 font-input-mono">
      <h3 className="mb-4">{item.title}</h3>
      <div className="text-sm text-gray-400">{item.speakers.join(' & ')}</div>
    </div>
    <p className="pt-8 pb-12 md:py-12 md:px-8 col-span-2 text-gray-400">
      {item.description}
    </p>
  </article>
);

const breakRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title} className="w-full grid grid-cols-1 md:grid-cols-5">
    <div className="pt-12 pb-8 md:py-12 font-input-mono">
      <span className="hidden md:block">{item.time}</span>
      <span className="py-4 px-6 mb-4 bg-blue-nx-dark rounded-md md:hidden">
        {item.time}
      </span>
    </div>
    <div className="pb-12 md:py-12 md:px-8 md:col-span-4 md:border md:border-t-0 md:border-r-0 md:border-b-0 md:border-gray-600">
      <h3 className="font-input-mono">{item.title}</h3>
      <div className="description">{item.description}</div>
    </div>
  </div>
);
