import { breakRow, ScheduleItem, scheduleRow } from '../components/schedule';

export function LaunchWeekAgenda(): JSX.Element {
  const scheduleItemsConference: ScheduleItem[] = [
    {
      type: 'event',
      time: '2:00pm',
      title: 'Opening Remarks',
      description: '',
      speakers: ['Jeff Cross', 'Juri Strumpflohner', 'Zack DeRose'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '2:05pm',
      title: 'Nx Project Crystal',
      description: '',
      speakers: ['Juri Strumpflohner'],
      videoUrl: 'https://youtu.be/PzCgpM7qtTU',
    },
    {
      type: 'event',
      time: '2:40pm',
      title: 'Project Crystal + .NET in Action',
      description: '',
      speakers: ['Craigory Coppola'],
      videoUrl: 'https://youtu.be/fh-yzOuQGE8',
    },
    {
      type: 'event',
      time: '2:55pm',
      title: 'Nx Agents Walkthrough: Effortlessly Fast CI Built for Monorepos',
      description: '',
      speakers: ['Rareş Matei'],
      videoUrl: 'https://youtu.be/XS-exYYP_Gg',
    },
    {
      type: 'event',
      time: '3:20pm',
      title: 'Solving E2E Tests',
      description: '',
      speakers: ['Altan Stalker'],
      videoUrl: 'https://youtu.be/EO_tGa0Nx1s',
    },
    {
      type: 'event',
      time: '3:40pm',
      title: 'Releasing Nx Release',
      description: ``,
      speakers: ['James Henry'],
      videoUrl: 'https://youtu.be/KjZKFGu3_9I',
    },
    {
      type: 'event',
      time: '4:10pm',
      title: 'Special Announcement',
      description: ``,
      speakers: ['Zack DeRose'],
      videoUrl: 'https://youtu.be/Xfvv09wSoM8',
    },
    {
      type: 'event',
      time: '4:15pm',
      title: `Closing Remarks`,
      description: '',
      speakers: ['Juri Strumpflohner', 'Zack DeRose'],
      videoUrl: '',
    },
  ];

  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      <section className="w-full divide-y divide-slate-200 border-b border-t border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
          <article className="md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
            <div className="px-5 py-12 md:pr-12">
              <p className="mb-4">
                Nx Launch Conf is a free, online, half-day event taking a deeper
                dive into our Launch Week announcements.
              </p>
              <a
                rel="noreferrer"
                target="_blank"
                href="https://youtu.be/fy0K2Smyj5A"
                className="font-input-mono group flex w-full items-center text-blue-500 sm:text-xl dark:text-sky-500"
              >
                <span className="group-hover:underline">
                  Watch the conference recording
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="ml-1 h-8 w-8 transform-gpu transition duration-200 ease-out group-hover:translate-x-2 "
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </a>
            </div>
          </article>
        </div>
        <div className="w-full">
          <div className="mx-auto max-w-screen-lg px-5 py-12 md:pr-12 xl:max-w-screen-xl">
            <span className="rounded-md bg-slate-100 p-2 dark:bg-slate-800">
              Thursday, February 8th
            </span>
            <p className="mt-4">
              Note: all time indications are in the Eastern Standard timezone
              (UTC-05:00).
            </p>
          </div>
        </div>
        {scheduleItemsConference.map((item) => launchWeekScheduleRow(item))}
      </section>
    </div>
  );
}

const launchWeekScheduleRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
      <article className="grid w-full grid-cols-1 md:grid-cols-5 md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
        <div className="font-input-mono flex items-center px-5 py-6">
          <span className="hidden md:block">{item.time}</span>
          <span className="mb-4 rounded-md px-6 py-4 md:hidden">
            {item.time}
          </span>
        </div>
        <div className="font-input-mono col-span-2 flex items-center px-5 py-6 md:px-8">
          {item.videoUrl ? (
            <h3 className="underline">
              <a href={item.videoUrl} target="_blank" rel="noreferrer">
                {item.title}
              </a>
            </h3>
          ) : (
            <h3>{item.title}</h3>
          )}
        </div>
        <p className="col-span-2 flex items-center px-5 py-6 md:px-8">
          {item.speakers.length > 2
            ? `${item.speakers.slice(0, -1).join(', ')}, & ${item.speakers.at(
                -1
              )}`
            : item.speakers.join(' & ')}
        </p>
      </article>
    </div>
  </div>
);
