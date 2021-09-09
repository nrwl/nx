import { useState } from 'react';

interface ScheduleItem {
  description: string;
  speakers: Array<string>;
  time: string;
  title: string;
  type: 'event' | 'break';
}

export function ConfSchedule(): JSX.Element {
  const [activeDay, setActiveDay] = useState(1);

  const scheduleItemsFor16: ScheduleItem[] = [
    {
      type: 'event',
      time: '10-10:45am',
      title: 'Keynote',
      description: '',
      speakers: ['Jeff Cross', 'Victor Savkin / Nrwl'],
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
      time: '11-11:25am',
      title: 'Go-To-Market with Nx',
      description:
        'Does a startup really need a tool like Nx from Day One? Let’s take a look at Nx through the eyes of a startup trying to ship its first project. How does Nx accelerate the growth and adaptation necessary for a new venture?',
      speakers: ['Jason Jean / Nrwl'],
    },
    {
      type: 'event',
      time: '11:30-11:55am',
      title: 'Micro Frontends and Nx Monorepos: The Best of Two Worlds?',
      description: `Micro Frontends “by the book” are managed in different repositories. However, many Angular developers value the comfort and features provided by monorepos. This session will use Nx and Module Federation to show how to get the best of both worlds including sharing libraries between micro frontends, enforcing isolation, and deployment strategies.`,
      speakers: ['Manfred Steyer / Angular Architects'],
    },
    {
      type: 'event',
      time: '12-12:25pm',
      title:
        'Generators, Executors and Plugins - Automating for Speed and Quality with the Nx Devkit',
      description: `One of Nx’s primary advantages is seamless integration of different tools through automation which we roughly categorized into: executors, generators, and plugins. Nx comes with different packages that already have all of these built-in, but you can also leverage the @nrwl/devkit API to create custom generators, executors and plugins to meet the needs of your specific workspace.`,
      speakers: ['Juri Strumpflohner / Nrwl'],
    },
    {
      type: 'break',
      time: '12:25-12:45pm',
      title: 'Q&A',
      description: '',
      speakers: [],
    },
    {
      type: 'break',
      time: '12:45-1:30pm',
      title: 'Lunch Break',
      description: '',
      speakers: [],
    },
    {
      type: 'event',
      time: '1:30-1:55pm',
      title: 'Nx for your Stack',
      description: `Take Nx beyond JavaScript incrementally, starting with only a few simple steps. From run-commands and shell scripts, up to a full custom plugin, Nx is capable of handling any language and tooling thrown at it. Experience the full benefits Nx provides in Angular, React, and Node, with the full stack of your choice.`,
      speakers: ['Craigory Coppola / Nrwl'],
    },
    {
      type: 'event',
      time: '2-2:25pm',
      title: 'Revealing the Identity of the "x" in Nx',
      description: `Have you heard of Nx? Is it the missing variable in the algebraic expression to solving the nature of our universe? It just might be. Many JavaScript developers live in a universe of TypeScript these days, and Nx is a distinguished variable in solving a multitude of universal TypeScript challenges. Let's explore how Nx can be transformational when it comes to harnessing the power of our TypeScript codebases and how it can help keep us in-line with it's evolutionary journey.`,
      speakers: ['Nathan Walker / nStudio'],
    },
    {
      type: 'break',
      time: '2:30-2:45pm',
      title: 'Q&A',
      description: '',
      speakers: [],
    },
    {
      type: 'break',
      time: '2:45-3:00pm',
      title: 'Break',
      description: '',
      speakers: [],
    },
    {
      type: 'event',
      time: '3pm-3:25pm',
      title: 'Design Systems for Enterprise',
      description: `If you are part of a large organization or team, chances are you need a design system. A combination of Nx and Storybook will make that process more efficient, more enjoyable, and definitely more scalable. Storybook helps you build "UI components in isolation". Combined with Nx and the architecture of a Nx workspace, you can have your UI libraries easily "browsable" and testable by your whole dev and UI/UX teams.`,
      speakers: ['Katerina Skroumpleou', 'Rares Matei / Nrwl'],
    },
    {
      type: 'break',
      time: '3:30-3:55pm',
      title: 'Community Lightning Talks',
      description: '',
      speakers: [],
    },
    {
      type: 'break',
      time: '4:00-4:20pm',
      title: 'Q&A',
      description: '',
      speakers: [],
    },
    {
      type: 'event',
      time: '4:20-4:30pm',
      title: 'Closing Remarks',
      description: '',
      speakers: ['Jeff Cross', 'Brandon Roberts / Nrwl'],
    },
  ];
  const scheduleItemsFor17: ScheduleItem[] = [
    {
      type: 'event',
      time: '10-10:45am',
      title: 'Nrwl/Nx Team Panel',
      description: '',
      speakers: ['Nrwlians'],
    },
    {
      type: 'break',
      time: '10:45-11am',
      title: 'Break',
      description: '',
      speakers: [],
    },
    {
      type: 'break',
      time: '11-11:25am',
      title: 'Community Lightning Talks',
      description: '',
      speakers: [''],
    },
    {
      type: 'event',
      time: '11:30-11:55am',
      title: 'Debugging a NestJS Application',
      description:
        "In this talk, we'll discuss the process of debugging a NestJS application within Nx.",
      speakers: ['Yvonne Allen'],
    },
    {
      type: 'event',
      time: '12-12:25pm',
      title: 'Optimizing Workspaces for Nx',
      description: `In this talk, we’ll discuss the concerns to consider when architecting an Nx workspace, and discuss how to be proactive in managing your dependency graph to get the most out of developer productivity, and reduce the risk of dreaded circular dependencies.`,
      speakers: ['Zack DeRose / Nrwl'],
    },
    {
      type: 'break',
      time: '12:25-12:45',
      title: 'Q&A',
      description: '',
      speakers: [],
    },
    {
      type: 'event',
      time: '1:30-1:55pm',
      title: 'Solving Problems with the Dependency Graph',
      description: `The dependency graph can be a powerful part of your workspace, but it can be hard to parse 
        much information from the visualization, especially in large projects. In this talk, you’ll learn about 
        strategies to cut your graph down to size to understand more visually and also how to use the 
        JSON output of the graph when a visual just won’t cut it.`,
      speakers: ['Philip Fulcher / Nrwl'],
    },
    {
      type: 'event',
      time: '2:00-2:25pm',
      title: 'ESLint: Your Nx Workspace Rules',
      description: `In this talk we will cover what it takes to create and run lint rules directly in your Nx workspace specific to your workspace’s own requirements and best practices. Want to learn how to avoid using developer time to police your contributing conventions in PR reviews? How to add auto fixing so the correct solutions are a command away? How to leverage existing utilities from the ESLint ecosystem to avoid writing invalid rules? Then this talk is for you!`,
      speakers: ['James Henry'],
    },
    {
      type: 'break',
      time: '2:30-2:45pm',
      title: 'Q&A',
      description: '',
      speakers: [],
    },
    {
      type: 'break',
      time: '2:45-3:00',
      title: 'Break',
      description: '',
      speakers: [],
    },
    {
      type: 'event',
      time: '3:00-3:25pm',
      title: 'Optimize your development workflow with Nx Cloud',
      description: `It's 2021 - time to break away from unintelligent CI set ups, and rudimentary local development 
      workflows. This talk covers how different features of Nx Cloud power up your Nx development.`,
      speakers: ['Kirils Ladovs / Nrwl'],
    },
    {
      type: 'event',
      time: '3:30-3:55pm',
      title: 'Lose Your Fear of Package Updates',
      description: `How can you scare any engineer in two words? Version updates. One of Nx’s superpowers is being able 
      to run common commands incrementally -- but what about commands that we run less frequently? Learn how Nx makes 
      the upgrade path to latest so simple that you and your team won’t want to miss a version bump for your framework 
      again.`,
      speakers: ['Altan Stalker / Nrwl'],
    },
    {
      type: 'break',
      time: '4:00-4:20',
      title: 'Q&A',
      description: '',
      speakers: [],
    },
    {
      type: 'event',
      time: '4:20-4:30pm',
      title: 'Closing Remarks',
      description: '',
      speakers: ['Jeff Cross', 'Brandon Roberts / Nrwl'],
    },
  ];

  return activeDay === 1 ? (
    <div className="border-t border-gray-600">
      <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto text-white">
        <div className="date-container-l grid grid-cols-2 font-input-mono divide-x divide-gray-600">
          <div className="p-8 text-center bg-blue-nx-dark">September 16</div>
          <div
            className="p-8 text-center cursor-pointer"
            onClick={() => setActiveDay(2)}
          >
            September 17
          </div>
        </div>
      </div>
      <section className="w-full border-t border-b border-gray-600 divide-y divide-gray-600">
        {scheduleItemsFor16.map((item) =>
          item.type === 'event' ? scheduleRow(item) : breakRow(item)
        )}
      </section>
    </div>
  ) : (
    <div>
      <div className="border-t border-gray-600">
        <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto text-white">
          <div className="date-container-r grid grid-cols-2 font-input-mono divide-x divide-gray-600">
            <div
              className="p-8 text-center cursor-pointer"
              onClick={() => setActiveDay(1)}
            >
              September 16
            </div>
            <div className="p-8 text-center bg-blue-nx-dark">September 17</div>
          </div>
        </div>
        <section className="w-full border-t border-b border-gray-600 divide-y divide-gray-600">
          {scheduleItemsFor17.map((item) =>
            item.type === 'event' ? scheduleRow(item) : breakRow(item)
          )}
        </section>
      </div>
    </div>
  );
}

const scheduleRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto text-white">
      <article className="w-full grid grid-cols-1 md:grid-cols-5 md:divide-x md:divide-gray-600">
        <div className="px-5 pt-12 pb-8 md:py-12 font-input-mono">
          <span className="hidden md:block">{item.time}</span>
          <span className="py-4 px-6 mb-4 bg-blue-nx-dark rounded-md md:hidden">
            {item.time}
          </span>
        </div>
        <div className="px-5 md:py-12 md:px-8 col-span-2 font-input-mono">
          <h3 className="mb-4">{item.title}</h3>
          <div className="text-sm text-gray-400">
            {item.speakers.join(' & ')}
          </div>
        </div>
        <p className="px-5 pt-8 pb-12 md:py-12 md:px-8 col-span-2 text-gray-400">
          {item.description}
        </p>
      </article>
    </div>
  </div>
);

const breakRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto text-white">
      <div className="w-full grid grid-cols-1 md:grid-cols-5">
        <div className="px-5 pt-12 pb-8 md:py-12 font-input-mono">
          <span className="hidden md:block">{item.time}</span>
          <span className="py-4 px-6 mb-4 bg-blue-nx-dark rounded-md md:hidden">
            {item.time}
          </span>
        </div>
        <div className="pb-12 md:py-12 px-5 md:px-8 md:col-span-4 md:border-l md:border-gray-600">
          <h3 className="font-input-mono">{item.title}</h3>
          <div className="description">{item.description}</div>
        </div>
      </div>
    </div>
  </div>
);
