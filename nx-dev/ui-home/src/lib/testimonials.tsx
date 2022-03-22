import { TestimonialCard } from '@nrwl/nx-dev/ui-common';
import { ReactComponentElement } from 'react';

export function Testimonials(): ReactComponentElement<any> {
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
    {
      link: 'https://twitter.com/241Dev/status/1487531051484278791',
      title: 'Web Engineer',
      author: 'Akira Tsuboi',
      imageUrl: '/images/testimonials/akira-tsuboi.jpg',
      content: 'I just started using Nx (@NxDevTools). It’s awesome 😍',
    },
  ];
  const column2 = [
    {
      author: 'Kent C. Dodds',
      content: 'Wow, @NxDevTools is no joke. This is awesome!',
      imageUrl: '/images/testimonials/kent-c-dodds.jpg',
      link: 'https://twitter.com/kentcdodds/status/1487079957536788480',
      title: 'Co-founder and Director of Developer Experience at Remix.run',
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
  ];
  const column3 = [
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

  return (
    <div id="testimonials-tweets">
      <div className="flex p-4 lg:mx-auto lg:max-w-7xl">
        <div className="grid w-full grid-cols-1 items-start gap-12 md:grid-cols-2 lg:grid-cols-3">
          <div className="flex w-full flex-col space-y-8">
            {column1.map((data) => (
              <TestimonialCard key={data.author} data={data} />
            ))}
          </div>
          <div className="flex w-full flex-col space-y-8">
            {column2.map((data) => (
              <TestimonialCard key={data.author} data={data} />
            ))}
          </div>
          <div className="flex w-full flex-col space-y-8">
            {column3.map((data) => (
              <TestimonialCard key={data.author} data={data} />
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Testimonials;
