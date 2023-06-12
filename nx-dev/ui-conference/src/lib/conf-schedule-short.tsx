interface ScheduleItem {
  description: string;
  speakers: Array<string>;
  time: string;
  title: string;
  type: 'event' | 'break';
  videoUrl?: string;
}

export function ConfScheduleShort(): JSX.Element {
  const scheduleItemsDiscussions: ScheduleItem[] = [
    {
      type: 'event',
      time: '9:00am - 5:00pm (UTC-07:00)',
      title: 'Nx Workshop - Day 2',
      description:
        'Note, environment setup starts at 8am. Join day 2 to take a deep dive into advanced Nx concepts that help you leverage Nx to its fullest. More details in the workshop section further down.',
      speakers: ['Zack DeRose', 'Miroslav Jonas'],
      videoUrl: '',
    },
  ];
  const scheduleItemsConference: ScheduleItem[] = [
    {
      type: 'event',
      time: '8:30 - 9:30am (UTC-07:00)',
      title: 'Registration',
      description: 'Conference registration',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '9:30 - 9:45am (UTC-07:00)',
      title: 'Welcome & Opening Remarks',
      description: '',
      speakers: ['Jeff Cross', 'Katerina Skroumpelou', 'Philp Fulcher'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '9:50 - 10:15am (UTC-07:00)',
      title: 'Keynote - Nx and Lerna: Integrated vs Package-Based Monorepos',
      description:
        'The JS community has two main styles of monorepos: the “package-based” approach (popularized by Lerna) and the “integrated” style (popularized by Nx, used by Google, Facebook etc.). While one is lightweight and easy to adopt, the other gives much more flexibility, scales better, and provides better dev ergonomics but requires a mind shift.\n' +
        'In this talk, we’ll have a deeper look at how Lerna and Nx implement these approaches, the trade-offs, and the advantages; we will help you pick the right one and show how to migrate from one to the other.\n',
      speakers: ['Victor Savkin'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '10:20 - 10:45am (UTC-07:00)',
      title: 'Re-thinking CI bottlenecks with Distributed Execution',
      description:
        'Nx’s powerful caching algorithms and dependency graph knowledge allow you to build simple CI pipelines that scale as your workspace grows. But caching and affected work best in the average case: when only some projects are changed in a PR, you can skip anything that can’t be affected by that change, and from the remaining ones the caching algorithms will help you replay all the work that has been done before. But after a certain point you have to start splitting the work across multiple agents if you want your workspace to scale.      In this talk we’ll explore why your CI can slow down in big workspaces, and how you can unlock horizontal scaling by distributing your tasks across multiple machines. We’ll look at some of the issues with task distribution and how you can use NxCloud workflows to implement scalable CI configs that optimally splits the work across your matrix of agents.',
      speakers: ['Rareş Matei', 'Altan Stalker'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '10:50 - 11:15am (UTC-07:00)',
      title: 'Lerna Reborn',
      description:
        "Lerna blazed the original trail in the open-source JavaScript monorepo space, and the whole ecosystem has benefitted immensely from that experience. It remains extremely popular for versioning/publishing and full monorepo workspace management, and now that the Nrwl Team has taken over stewardship of the project, we want to share some of the great updates we've made over the last few months as well as what we have planned for the near future.",
      speakers: ['James Henry'],
      videoUrl: '',
    },
    {
      type: 'break',
      time: '11:15 - 11:35am (UTC-07:00)',
      title: 'Break',
      description: '',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '11:35 - 11:55pm (UTC-07:00)',
      title: 'Nx + Cypress Like Peanut Butter & Jelly',
      description:
        "Name a more iconic duo than Nx & Cypress... I'll wait. In this talk I will highlight some of ways in which Nx integrates seamlessly with Cypress and how it can speed up both your development and overall developer experience. We will also take a look at Cypress Component Testing and how you can leverage Nx in your testing. By the end you will see why Nx and Cypress are the peanut butter and jelly of your developer toolbox.",
      speakers: ['Jordan Powell'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '12:05 - 12:15pm (UTC-07:00)',
      title: 'CI/CD tricks with Nx',
      description:
        '⚡️ Lightning talk - Nx is great at telling us what changed and what needs to be rebuilt and/or deployed. How do we use this information to dynamically trigger CICD pipelines or workflows? In this talk we’ll review some tricks to generate dynamic configuration for both Azure DevOps and CircleCI that help to solve this problem. ',
      speakers: ['Kennie Davis'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '12:15 - 12:25pm (UTC-07:00)',
      title: 'Exploring Library Boundaries for State Management Libraries',
      description:
        '⚡️ Lightning talk - State management libraries like Redux, Vuex, and NgRx give developers tools to introduce indirection between state management, side effects, and the view layer. Quickly learn about the ramifications indirection introduces for Nx libraries and explore ideas about creating module boundaries around your state management code.',
      speakers: ['Mike Ryan'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '12:25 - 12:35pm (UTC-07:00)',
      title: 'Nx Workspace Guardrails',
      description:
        '⚡️ Lightning talk - Concept: in a Nx monorepo with lots of contributors, how do you help ensure engineers follow the desired patterns for development?  You may have a roadmap for where you want to go, but how do you make sure folks don’t slide off the cliff along the way?  You need some guardrails to help keep people on track.  Thankfully, Nx has got you covered. We’ll show how built-in tools like workspace lint, ESLint, and workspace ESLint rules can help put checks in place to ensure the overall health of your workspace.',
      speakers: ['Ryan Diehl'],
      videoUrl: '',
    },
    {
      type: 'break',
      time: '12:35 - 1:50pm (UTC-07:00)',
      title: 'Lunch',
      description: '',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '1:50 - 2:15pm (UTC-07:00)',
      title: 'Extending Nx: Polyglot Superpowers',
      description:
        "Extensibility is in Nx's DNA, and having a tool that you can extend and customize to your monorepo setup is crucial. Sharing different languages in a monorepo is extremely common yet toolchains usually don't play well together. Fortunately, Nx allows you to extend its capabilities to integrate your whole stack. Use Nx's graph on your Go or Python code and see what is affected, or generate Go code via Nx. Make Nx polyglot to take advantage of affected tests and remote caching for all your tech stack.",
      speakers: ['Jack Hsu', 'Benjamin Cabanes'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '2:20 - 2:45pm (UTC-07:00)',
      title: 'Nx, Ionic, Appflow: Navigating the Wild West of Hybrid Apps',
      description:
        'These days there are a lot of ways to build mobile apps. But what if you want to share your types across the frontend and backend, or share components and logic across your mobile and web app, and maybe an admin panel? At this point, your options get pretty limited, and things only get more complicated once you start thinking about how to automate building and deploying your native apps to the app store. In this talk, we’ll explore how to develop Ionic applications in an Nx workspace and how to configure Appflow for automated app store deployments.',
      speakers: ['Devin Shoemaker'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '2:50 - 3:15pm (UTC-07:00)',
      title: 'Nx at Celonis',
      description:
        'Celonis adopted AngularJS in 2011, 5 years later in 2016 we had fewer applications to manage, and individual teams were responsible for each application, soon we found there are many issues with each team owning the code, we are duplicating some code, some teams dont have frontend developers and are sometimes dependent on each other is delaying the development workflow. Celonis decided to introduce the project "One Frontend" and we chose Nx and use Module Federation, join us to learn about the journey of Celonis migrating to Nx, why we chose Nx, and how CLI made our life easier, and what Nx\'s future is at Celonis.',
      speakers: ['Santosh Yadav'],
      videoUrl: '',
    },
    {
      type: 'break',
      time: '3:15 - 3:45pm (UTC-07:00)',
      title: 'Break',
      description: '',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '3:40 - 4:10pm (UTC-07:00)',
      title: 'Make Nx Work for You with Custom Generators',
      description:
        'There is a lot the Nx can do for your application right out of the box, but did you know you can write custom workspace generators specific to YOUR application to help automate the various tasks your team performs on a daily basis? Why write yet another confluence page documenting all of the little things that have to be done after generating a library when you can write a workspace generator that handles all of the little details for you? In this talk we will cover everything you need to know to create your own workspace generator to help reduce manual tasks, enforce architectural patterns, and generate more consistent predictable code.',
      speakers: ['Lara Newsom'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '4:15 - 4:40pm (UTC-07:00)',
      title: 'The power of Nx Console',
      description:
        'Are you tired of searching the docs for the exact name of that Nx command flag? Or do you want to explore what’s possible but don’t know where to start? Nx isn’t just fast! We deeply care about the developer experience too! Every command, with all its options, running tasks, and the Nx graph. Just fingertips away so you can keep focused and remain in the flow. In this talk, we’re going deep into how to augment your Nx experience in VSCode! Not a VSCode user? Then be all ears: we might have a surprise.',
      speakers: ['Jonathan Cammisuli'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '4:45 - 5:00pm (UTC-07:00)',
      title: 'Closing Remarks',
      description: '',
      speakers: ['Jeff Cross'],
      videoUrl: '',
    },
    {
      type: 'break',
      time: '8:00pm - 12:00am (UTC-07:00)',
      title: 'After Party',
      description: 'Location: Cloister',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'break',
      time: '8:00pm - 12:00am (UTC-07:00)',
      title: 'Networking, Games & Activities',
      description: 'Location: Palms Courtyard',
      speakers: [],
      videoUrl: '',
    },
  ];

  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
        <div className="date-container-l font-input-mono mt-16 grid grid-cols-1 divide-x divide-slate-200 dark:divide-slate-700">
          <div className="p-8 text-center">
            <span className="rounded-md bg-slate-100 p-2 dark:bg-slate-800">
              Tuesday, September 26th
            </span>
          </div>
        </div>
      </div>
      <section className="w-full divide-y divide-slate-200 border-t border-b border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
          <article className="md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
            <div className="px-5 py-12 md:pr-12">
              <p className="mb-4">
                Main conference day with speakers from the Nx core team and
                selected community speakers.
              </p>
              <p className="mb-4">
                The detailed scheduled will be announced soon.
              </p>
            </div>
          </article>
        </div>
        {/* {scheduleItemsConference.map((item) =>
          item.type === 'event' ? scheduleRow(item) : breakRow(item)
        )} */}
      </section>

      {/* {scheduleItemsDiscussions.map((item) =>
          item.type === 'event' ? scheduleRow(item) : breakRow(item)
        )} */}
    </div>
  );
}

const scheduleRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
      <article className="grid w-full grid-cols-1 md:grid-cols-5 md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
        <div className="font-input-mono px-5 pt-12 pb-8 md:py-12">
          <span className="hidden md:block">{item.time}</span>
          <span className="mb-4 rounded-md py-4 px-6 md:hidden">
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
          <div className="text-sm">{item.speakers.join(' & ')}</div>
        </div>
        <p className="col-span-2 px-5 pt-8 pb-12 md:py-12 md:px-8">
          {item.description}
        </p>
      </article>
    </div>
  </div>
);

const breakRow = (item: ScheduleItem): JSX.Element => (
  <div key={item.title + item.time} className="w-full">
    <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
      <div className="grid w-full grid-cols-1 md:grid-cols-5">
        <div className="font-input-mono px-5 pt-12 pb-8 md:py-12">
          <span className="hidden md:block">{item.time}</span>
          <span className="mb-4 rounded-md py-4 px-6 md:hidden">
            {item.time}
          </span>
        </div>
        <div className="px-5 pb-12 md:col-span-4 md:border-l md:border-slate-200 md:py-12 md:px-8 md:dark:border-slate-700">
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
