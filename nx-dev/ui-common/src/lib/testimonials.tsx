import { ChatBubbleLeftEllipsisIcon } from '@heroicons/react/24/outline';
import { SectionHeading } from './typography';

export function Testimonials(): JSX.Element {
  return (
    <section id="people-are-talking" className="relative">
      <header className="mx-auto max-w-2xl text-center">
        <SectionHeading as="h2" variant="title">
          People are talking
        </SectionHeading>
        <SectionHeading as="p" variant="subtitle" className="mt-6">
          Whether your workspace{' '}
          <span className="font-semibold">
            has a single project or thousands
          </span>
          , Nx will keep your CI fast and your workspace maintainable.
        </SectionHeading>
      </header>
      <div className="md:px-62 mx-auto grid max-w-7xl grid-cols-1 items-stretch gap-8 px-4 py-12 md:grid-cols-3 lg:px-8 lg:py-16">
        <div className="rounded-xl bg-slate-50 p-10 dark:bg-slate-800/60">
          <ChatBubbleLeftEllipsisIcon className="h-8 w-8 text-blue-500 dark:text-sky-500" />
          <p className="mt-4">
            "It made it possible to remove our hand-rolled code and to use a
            well-maintained and streamlined solution, increasing performance
            while saving us a lot of time and money. The developer experience is
            so good."
          </p>
          <div className="mt-8 font-semibold">Nitin Vericherla</div>
          <div className="mt-0.5 text-sm">UI Architect at Synapse Wireless</div>
        </div>
        <div className="rounded-xl bg-slate-50 p-10 dark:bg-slate-800/60">
          <ChatBubbleLeftEllipsisIcon className="h-8 w-8 text-blue-500 dark:text-sky-500" />
          <p className="mt-4">
            "By updating to the latest Lerna version and enabling Nx caching, we
            were able to reduce CI build times by ~35% - a great time saving for
            a fast-moving company like Sentry with an extremely active
            repository."
          </p>
          <div className="mt-8 font-semibold">Francesco Novy</div>
          <div className="mt-0.5 text-sm">
            Senior Software Engineer at Sentry
          </div>
        </div>
        <div className="rounded-xl bg-slate-50 p-10 dark:bg-slate-800/60">
          <ChatBubbleLeftEllipsisIcon className="h-8 w-8 text-blue-500 dark:text-sky-500" />
          <p className="mt-4">
            "Since we are using NxCloud, we saw our CI times reduced by 83%!
            That means our teams are not waiting hours for their PR to be merged
            anymore, we reclaimed our productivity and are pretty happy about
            it."
          </p>
          <div className="mt-8 font-semibold">Laurent Delamare</div>
          <div className="mt-0.5 text-sm">Senior Engineer at VMware</div>
        </div>
      </div>
    </section>
  );
}
