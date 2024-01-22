import { SectionHeading, TestimonialCard } from '@nx/nx-dev/ui-common';

export function Testimonials(): JSX.Element {
  const column1 = [
    {
      link: 'https://twitter.com/antoinepairet/status/1488882179434328065',
      title: 'Co-founder and CTO at @HealthRosa',
      author: 'Antoine Pairet',
      imageUrl: '/images/testimonials/antoine-pairet.jpg',
      content:
        "I can't recommend @NxDevTools enough! Go use it, your future self says thanks ;-). Have a doubt or a question? Reach out to @nrwl_io, they are kind, smart, and willing to help",
    },
    {
      link: 'https://twitter.com/danm_t/status/1504832834271330313',
      title: 'Developer',
      author: 'Daniel Marin',
      imageUrl: '/images/testimonials/daniel-marin.jpg',
      content: [
        "I'd def invest in @nrwl_io - Our whole platform for @HeavyDutyBuild is powered by it.",
        "We're using Nx in a monorepo with an @angular Dapp, a @nestframework API and a @solana Rust Program.",
        "A year ago I used Nx for my Angular stuff, now it's a core piece of everything I build.",
      ].join(' '),
    },
  ];
  const column2 = [
    {
      author: 'Tomek Sułkowski',
      content:
        "Supporting @NxDevTools was an exciting goal for @StackBlitz: it's a remarkably elegant setup – but also a great test for WebContainers' maturity, so we're so happy to have reached this milestone!",
      imageUrl: '/images/testimonials/tomek-sulkowski.jpg',
      link: 'https://twitter.com/sulco/status/1455207019942748162',
      title: '@StackBlitz Founding Engineer & DevRel',
    },
    {
      author: 'Michael Bromley',
      content:
        'Just set up a full-stack Angular/NestJS app with @NxDevTools. One command, about 5 minutes, and a working full-stack "hello world". Probably just saved about 2 hours.',
      imageUrl: '/images/testimonials/michael-bromley.jpg',
      link: 'https://twitter.com/i/web/status/1403437555769561090',
      title: 'Creator of @vendure_io',
    },
  ];
  const column3 = [
    {
      author: 'Kent C. Dodds',
      content: 'Wow, @NxDevTools is no joke. This is awesome!',
      imageUrl: '/images/testimonials/kent-c-dodds.jpg',
      link: 'https://twitter.com/kentcdodds/status/1487079957536788480',
      title: 'Teacher, OSS',
    },
    {
      author: 'Tejas Kumar',
      content:
        "There is a lot to be learned from @nrwl_io's Nx developer experience. It is exemplary.",
      imageUrl: '/images/testimonials/tejas-kumar.jpg',
      link: 'https://twitter.com/TejasKumar_/status/1503676694208655361',
      title: 'Director of Developer Relations, @xatabase',
    },
    {
      author: 'Alan Montgomery',
      content:
        'Beautiful! I’m using NX on a nextjs/tailwind project and I must say it’s such a nice developer experience',
      imageUrl: '/images/testimonials/alan-montgomery.jpg',
      link: 'https://twitter.com/93alan/status/1488825290973405184',
      title: 'Senior React Dev/Mobile Team Lead @Idox',
    },
    {
      link: 'https://twitter.com/241Dev/status/1487531051484278791',
      title: 'Web Engineer',
      author: 'Akira Tsuboi',
      imageUrl: '/images/testimonials/akira-tsuboi.jpg',
      content: 'I just started using Nx (@NxDevTools). It’s awesome 😍',
    },
  ];

  return (
    <article
      id="next-generation"
      className="relative bg-slate-50 pt-28 dark:bg-slate-800/40"
    >
      <div className="mx-auto max-w-7xl items-stretch py-12 px-4 sm:grid sm:grid-cols-1 sm:gap-8 sm:px-6 md:grid-cols-3 lg:py-16 lg:px-8">
        <div className="md:col-span-2">
          <header>
            <SectionHeading as="h1" variant="title" id="testimonials">
              They use Nx every day
            </SectionHeading>
            <SectionHeading
              as="p"
              variant="display"
              id="nx-is-fast"
              className="mt-4"
            >
              Devs & CEOs, Startups & big companies are loving Nx
            </SectionHeading>
          </header>
          <div className="mt-8 flex gap-16 font-normal">
            <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
              Here is what they say about Nx, what they like about it, how it
              transforms their developer life and what you are missing out on!
            </p>
          </div>
          <div className="mt-12 grid grid-cols-1 gap-8 md:grid-cols-2">
            <div className="space-y-6">
              {column1.map((data) => (
                <TestimonialCard key={data.author} data={data} />
              ))}
            </div>
            <div className="space-y-6">
              {column2.map((data) => (
                <TestimonialCard key={data.author} data={data} />
              ))}
            </div>
          </div>
        </div>
        <div className="mt-6 flex h-full w-full flex-col items-start items-stretch gap-6 md:mt-0">
          {column3.map((data) => (
            <TestimonialCard key={data.author} data={data} />
          ))}
        </div>
      </div>
    </article>
  );
}
