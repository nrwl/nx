import { SectionHeading } from './section-tags';
import { TwitterIcon } from '@nx/nx-dev/ui-common';

const coFounders = [
  {
    name: 'Victor Savkin',
    title: 'Co-Founder, CTO',
    image: 'victor-savkin.avif',
    socials: [
      {
        icon: TwitterIcon,
        url: 'https://x.com/victorsavkin',
      },
    ],
  },
  {
    name: 'Jeff Cross',
    title: 'Co-Founder, CEO',
    image: 'jeff-cross.avif',
    socials: [
      {
        icon: TwitterIcon,
        url: 'https://x.com/jeffbcross',
      },
    ],
  },
];
export function CoFounders(): JSX.Element {
  return (
    <section>
      <div className="slate-100 border border-y bg-slate-50/40 dark:border-slate-800 dark:bg-slate-800/60">
        <div className="mx-auto max-w-7xl px-4 py-12 sm:px-6 lg:px-8 lg:py-24">
          <div className="space-y-12 lg:grid lg:grid-cols-3 lg:gap-8 lg:space-y-0">
            <div className="space-y-5 sm:space-y-4">
              <SectionHeading as="h2" variant="title">
                Meet Our <br /> Co-Founders
              </SectionHeading>
            </div>
            <div className="lg:col-span-2">
              <ul className="grid grid-cols-2 justify-items-center sm:-mt-8 lg:grid-cols-3 lg:gap-20">
                {coFounders.map((coFounder, _) => (
                  <li key={coFounder.name} className="sm:py-8">
                    <div className="space-y-4">
                      <div className="aspect-w-3 aspect-h-4">
                        <img
                          src={`/images/team/${coFounder.image}`}
                          alt={coFounder.name}
                          loading="eager"
                          className="rounded-lg object-cover shadow-lg"
                        />
                      </div>
                      <div>
                        <div className="space-y-4">
                          <div className="space-y-1 text-lg font-medium leading-6">
                            <h3 className="font-semi-bold leading-8 tracking-tight text-slate-800 dark:text-slate-200">
                              {coFounder.name}
                            </h3>
                            <p className="text-blue-500 dark:text-sky-500">
                              {coFounder.title}
                            </p>
                          </div>
                          <ul className="flex space-x-5">
                            {coFounder.socials.map((social, _) => (
                              <li key={social.url}>
                                <a
                                  href={social.url}
                                  className="text-blue-500 dark:text-sky-500"
                                >
                                  <social.icon className="h-5 w-5" />
                                </a>
                              </li>
                            ))}
                          </ul>
                        </div>
                      </div>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
