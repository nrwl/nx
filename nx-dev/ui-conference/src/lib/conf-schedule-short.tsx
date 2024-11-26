import { breakRow, ScheduleItem, scheduleRow } from './components/schedule';

export function ConfScheduleShort(): JSX.Element {
  const scheduleItemsDiscussions: ScheduleItem[] = [
    {
      type: 'event',
      time: '9:00am - 5:00pm',
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
      time: '7:00am',
      title: 'Breakfast & Registration',
      description: 'Conference registration',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '9:00am',
      title: 'Welcome & Opening Remarks',
      description: '',
      speakers: ['Jeff Cross', 'Lara Newsom', 'Philip Fulcher'],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '9:10am',
      title: 'Keynote',
      description: '',
      speakers: ['Juri Strumpflohner', 'Victor Savkin'],
      videoUrl: 'https://youtu.be/WSqivWlEDFw',
    },
    {
      type: 'event',
      time: '10:05am',
      title:
        'Nx Cloud Workflows: Next-Gen CI with First-Class Monorepo Support',
      description: `We're excited to provide an exclusive preview of Nx Cloud Workflows. In our first foray into delivering CI as part of Nx Cloud, we'll demonstrate how Workflows can simplify distributed executions as part of a typical CI pipeline, before talking about our long-term vision for the product.`,
      speakers: ['Simon Critchley'],
      videoUrl: 'https://youtu.be/JG1FWfZFByM',
    },
    {
      type: 'event',
      time: '10:35am',
      title:
        'United by Nxcellent DX - An Nx adoption plan for migrating and onboarding hundreds of developers to an Nx monorepo',
      description: `In one of our projects, Push-Based currently support a large enterprise. They are migrating from a complex .NET and Angular polyrepo setup to an organization-wide Nx monorepo for hundreds of developers that build web apps for 30 brands across a hundred domains. To achieve their Nx migration goals, we defined guiding principles and fitted an Nx adoption strategy.
 
      This talk covers the tactics we apply to avoid interrupting the teams' workflow and onboard them to Nx and a monorepo workflow. An important part is what we call the Migration Toolkit. This custom Nx plugin helps teams prepare their repo by identifying the minimum requirements for migrating to the Nx monorepo workspace and offering custom Nx migration generators.`,
      speakers: ['Michael Hladky'],
      videoUrl: 'https://youtu.be/i0UdoImryJQ',
    },
    {
      type: 'break',
      time: '10:55am',
      title: 'Break',
      description:
        'Get some snacks and coffee to be ready for the 2nd set of morning talks',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '11:25am',
      title: 'Redefining Projects with Nx: A Dive into the New Inference API',
      description: `In a continuous strive for improvement, we have revamped the project inference API, aiming to provide greater flexibility and power in defining and managing projects. This talk will walk through the evolution of the project inference API, highlighting the transition from a 1:1 file-to-project mapping to a more nuanced approach that handles complex project configurations. We'll explore the key advantages of the new API, including the ability to define multiple projects within a single file and set more comprehensive project properties. Join us to learn about these exciting changes and understand how they can enhance your work with Nx.`,
      speakers: ['Craigory Coppola'],
      videoUrl: 'https://youtu.be/bnjOu7iOrMg',
    },
    {
      type: 'event',
      time: '11:55',
      title: 'Package-based to Integrated: One Small Step or One Giant Leap?',
      description: `When you have a package-based repo, it can feel like the features of an integrated repo are all the way on the moon.  But, in the same way that Neil Armstrong had a whole team of people enabling him to take his one small step, you can take advantage of the hard work of the Nx team to incrementally move your package-based repo toward an integrated repo.

      Starting from a package-based repo, we'll enforce module boundaries, create and use code generators and, finally, use task executors and automate updating dependencies.  Together, these improvements add up to one giant leap forward in developer experience.`,
      speakers: ['Isaac Mann'],
      videoUrl: 'https://youtu.be/nY0_o7zWBLM',
    },
    {
      type: 'event',
      time: '12:25pm',
      title: `Nx't Level Publishing`,
      description:
        'In this talk we will dig into practical examples of various approaches to versioning and publishing packages from an Nx workspace.',
      speakers: ['James Henry'],
      videoUrl: 'https://youtu.be/p5qW5-2nKqI',
    },
    {
      type: 'break',
      time: '12:45pm - 2:45pm',
      title: 'Lunch',
      description: '',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '2:45pm',
      title:
        'Lightning Talk: What if your stories were - already - your e2e tests?',
      description: `Storybook interaction tests allow developers to verify the functional aspects of UI components by simulating user behavior and checking UI and state updates. They integrate with Storybook's existing stories, utilizing a 'play' function to recreate user interactions, effectively transforming these stories into comprehensive e2e tests. Nx enhances the testing process by providing generators for Storybook interaction tests. This means that you don't need third-party tools for e2e tests if you're already using Storybook. What's awesome is that everything is fully integrated into your project right off the bat, with zero extra setup needed. So you can focus on what matters: building amazing UIs, with the peace of mind that testing is taken care of.`,
      speakers: ['Katerina Skroumpelou'],
      videoUrl: 'https://youtu.be/SWlvsDNXCsQ',
    },
    {
      type: 'event',
      time: '3:00pm',
      title: 'Lightning Talk: Nx Cloud Demo',
      description: `We're going to take a tour through some of the features of our latest release of Nx Cloud. We'll show you some of the latest analytics, organization management tools and ways that Nx Cloud can help you figure out what's really going on in CI without digging through endless logs.`,
      speakers: ['Johanna Pearce'],
      videoUrl: 'https://youtu.be/xc6fJpwk4Lo',
    },
    {
      type: 'event',
      time: '3:25pm',
      title: 'From DIY to DTE - An Enterprise Experience',
      description: `Nobody likes a slow CI/CD pipeline. When working in a monorepo with hundreds of projects, it can be difficult to optimize your CI/CD for performance and efficiency. Sure, you can DIY a crafty solution for it, but why DIY when you can DTE? Nx distributed task execution (DTE) is designed to fully optimize your CI/CD performance. Although configuring DTE for large monorepos can be challenging, it's not impossible. In this talk, we'll explore an enterprise experience, where we start with a DIY solution for CI/CD performance, realize its limitations, and embark on a bumpy but promising journey towards Nx DTE.`,
      speakers: ['Adrian Baran'],
      videoUrl: 'https://youtu.be/MsUN0wQHPAs',
    },
    {
      type: 'event',
      time: '3:55pm',
      title: 'Vanquishing Deployment Dragons with Nx wizardry',
      description: `A tale about a brave peasant that is set on a journey to vanquish the deployment dragon that has been tormenting the poor villagers that just want to push their apps on (but not over) the edge and become the prince of the castle.

      This talk will take us on an epic journey with Nx and the powerful monorepo wizardry to show us how good tooling eventually defeats even the scariest of dev ops monsters.`,
      speakers: ['Miroslav Jonas'],
      videoUrl: 'https://youtu.be/jGF8vo2ChfI',
    },
    {
      type: 'break',
      time: '4:15pm',
      title: 'Break',
      description: '',
      speakers: [],
      videoUrl: '',
    },
    {
      type: 'event',
      time: '4:45pm',
      title: 'Optimizing your OSS infrastructure with Nx Plugins',
      description: `When building and maintaining open source projects, offloading maintenance is vital to continue working on the features you want to ship. Building, testing, distribution are all part of maintaining an open source project. This talk shows how to optimize your open source workflow through an Nx Plugin.`,
      speakers: ['Brandon Roberts'],
      videoUrl: 'https://youtu.be/bNuXH25CTO0',
    },
    {
      type: 'event',
      time: '5:05pm',
      title: 'Level Up Your Productivity with Nx Console',
      description: `Tired of typing endless CLI commands? Can't remember every generator option? Look no further than Nx Console!
      Nx Console is a game-changing tool designed to supercharge your productivity and seamlessly integrate with popular editors like Visual Studio Code and JetBrains editors (WebStorm, IntelliJ IDEA, PhpStorm).
      We will dive into the key features of Nx Console and demonstrate how it enhances code generation and boosts your ability to navigate and understand complex codebases. Leverage the full potential of Nx Console in your daily development workflow!
      `,
      speakers: ['Jonathan Cammisuli', 'Max Kless'],
      videoUrl: 'https://youtu.be/TTjVcWCdwVY',
    },
    {
      type: 'event',
      time: '5:25 - 5:30pm',
      title: 'Closing Remarks',
      description: '',
      speakers: ['Jeff Cross', 'Lara Newsom', 'Philip Fulcher'],
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
      <section className="w-full divide-y divide-slate-200 border-b border-t border-slate-200 dark:divide-slate-700 dark:border-slate-700">
        <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
          <article className="md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
            <div className="px-5 py-12 md:pr-12">
              <p className="mb-4">
                Main conference day with speakers from the Nx core team and
                selected community speakers.
              </p>
              <p className="mb-4">
                Note: all time indications are in New York timezone (UTC-04:00).
              </p>
            </div>
          </article>
        </div>
        {scheduleItemsConference.map((item) =>
          item.type === 'event' ? scheduleRow(item) : breakRow(item)
        )}
      </section>

      {/* {scheduleItemsDiscussions.map((item) =>
          item.type === 'event' ? scheduleRow(item) : breakRow(item)
        )} */}
    </div>
  );
}
