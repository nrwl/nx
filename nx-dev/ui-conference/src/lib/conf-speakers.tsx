import { Member, MemberCard } from '@nx/nx-dev/ui-member-card';

export function ConfSpeakers(): JSX.Element {
  const speakers: Array<Member> = [
    {
      description: 'Co-Founder/CEO of Nrwl, and collector of kunekune pigs.',
      imageUrl: '/images/conf/jeff-cross.webp',
      name: 'Jeff Cross',
      twitter: 'jeffbcross',
    },
    {
      description: 'Co-Founder/CTO of Nrwl',
      imageUrl: '/images/conf/victor-savkin.webp',
      name: 'Victor Savkin',
      twitter: 'victorsavkin',
    },
    {
      description:
        'Lara is a Software Engineering technical Leader on the Customer Experience Angular team at Cisco. Most of Lara’s career has been spent working in the full stack as a Software Consultant and she enjoys sharing the knowledge and experience she has gained with others through talks, blogs, or pairing with teammates. When she is not coding or teaching, Lara enjoys trail running, fostering rescue kittens, and traveling with her family.',
      imageUrl: '/images/conf/lara-newsom.webp',
      name: 'Lara Newsom',
      twitter: 'LaraNerdsom',
    },
    {
      description:
        'Santosh works as a Senior Software Engineer at Celonis and is a GDE for Angular, GitHub Star, and an Auth0 Ambassador, he loves contributing to Angular and its eco-system. He is co-founder of This is Learning. He is also the author of the Ngx-Builders package and part of NestJsAddOns core Team. He is also running This is Tech Talks talk show, where he invites industry experts to discuss different technologies.',
      imageUrl: '/images/conf/santosh-yadav.webp',
      name: 'Santosh Yadav',
      twitter: 'SantoshYadavDev',
    },
    {
      description:
        'Jordan is a Developer Experience Engineer at Cypress. He is passionate about writing "good code" that is easy to read, test and maintain over time. He has over a decade of experience in software development, marketing, design, and video production. Jordan also serves as the CEO & Co-Founder for the non-profit Dream On: Global. When he is not working, he spends his time as a husband, father and Cleveland sports fan.',
      imageUrl: '/images/conf/jordan-powell.webp',
      name: 'Jordan Powell',
      twitter: 'JordanPowell88',
    },
    {
      description:
        'Based in Montreal, Ben is an architect at Nrwl and a part of the Nx Core Team. He works with Fortune 500 companies across different industries to enable them to develop like Google, Microsoft, and Facebook. Astrophysics enthusiast.',
      imageUrl: '/images/conf/benjamin-cabanes.webp',
      name: 'Benjamin Cabanes',
      twitter: 'bencabanes',
    },
    {
      description:
        'Core contributor to Nx, and engineering manager at Nrwl. Jack has been doing web development for two decades, and has worked with both small and large organizations. He is passionate about helping teams achieve a high level of productivity through smart tooling and good architecture.',
      imageUrl: '/images/conf/jack-hsu.webp',
      name: 'Jack Hsu',
      twitter: 'jay_soo',
    },
    {
      description:
        "Based in Atlanta, GA, Altan is a senior engineer at Nrwl and works primarily on Nx Cloud. He's passionate about developer experience and helping organizations move quickly. When not building software, you can find him working on his keyboard or on a hike.",
      imageUrl: '/images/conf/altan-stalker.webp',
      name: 'Altan Stalker',
      twitter: 'StalkAltan',
    },
    {
      description:
        'Jon is the lead developer for the official Nx Console extension. He has been working as a developer for 15 years; building websites, web apps and server applications. He loves to write Typescript, and dabbles in a bit of Rust. Born and raised in Canada, he’ll always have a recommendation on what to put maple syrup on.',
      imageUrl: '/images/conf/jonathan-cammisuli.webp',
      name: 'Jonathan Cammisuli',
      twitter: 'jcammisuli',
    },
    {
      description:
        'Software engineer at Ionic working on the Cloud Team. Maintainer of the Ionic and Capacitor Nx plugins.',
      imageUrl: '/images/conf/devin-shoemaker.webp',
      name: 'Devin Shoemaker',
      twitter: 'paranoidcoder',
    },
    {
      description:
        'From the faraway lands of Scotland (but without the Scottish accent), Rareș works at Nrwl.io on NxCloud, helping teams speed up and scale their development practices. He enjoys learning by teaching and has multiple courses on Egghead.io and is a Scotland organiser for Codebar.io.',
      imageUrl: '/images/conf/rares-matei.webp',
      name: 'Rareş Matei',
      twitter: '__rares',
    },
    {
      description:
        'James leverages his expert knowledge of Nx to help the biggest enterprises on the planet provide maximum value to their customers. He is a prolific open-source contributor, ESLint Core Team Alum, and has worked on a number of projects alongside the TypeScript Team.',
      imageUrl: '/images/conf/james-henry.webp',
      name: 'James Henry',
      twitter: 'MrJamesHenry',
    },
    {
      description:
        "Miro is a senior engineer at Nrwl.io and a core member of the Nx team. He's interested in the front end of things, helping companies build scalable and performant applications. He enjoys sharing with the community, speaking, contributing to open source, and organizing events. Miro is co-founder of Angular Austria and co-organizer of Angular Vienna and ViennaJS meetups.",
      imageUrl: '/images/conf/miroslav-jonas.webp',
      name: 'Miroslav Jonas',
      twitter: 'meeroslav',
    },
    {
      description:
        'Zack is a Google Developer Expert in Angular, and a Senior Engineer and Engineering Manager for Nrwl, living in the desserts of San Tan Valley, Arizona. Zack particularly enjoys teaching other engineers, breaking down problems into manageable pieces, and building awesome stuff.',
      imageUrl: '/images/conf/zack-derose.webp',
      name: 'Zack DeRose',
      twitter: 'zackderose',
    },
    {
      description:
        'Senior Software Engineer at Nrwl, Nx core team, open source contributor, GDE for Angular/Web Technologies/Google Maps platform, WTM Ambassador, AngularAthens meetup co-founder. Mentoring women into tech, speaking about the cool things I do, climbing mountains and serving cats for life. More at psyber.city.',
      imageUrl: '/images/conf/katerina-skroumpelou.webp',
      name: 'Katerina Skroumpelou',
      twitter: 'psybercity',
    },
    {
      description:
        'Philip Fulcher is a senior engineer with Nrwl and an Nx core team member. He works with Fortune 500 clients to modernize their development practices with a monorepo approach. Philip lives in Colorado with his wife (who is much smarter than him) and two great kids.',
      imageUrl: '/images/conf/philip-fulcher.webp',
      name: 'Philip Fulcher',
      twitter: 'philipjfulcher',
    },
    {
      description:
        'Mike Ryan is a principal architect at LiveLoveApp, helping companies find absolute joy in shipping apps. He is a Google Developer Expert in Web Technologies and one of the co-creators of NgRx, an open-source collection of high-quality reactive extensions for Angular.',
      imageUrl: '/images/conf/mike-ryan.webp',
      name: 'Mike Ryan',
      twitter: 'MikeRyanDev',
    },
    {
      description:
        'Based out of State College, PA, Ryan is an Engineering Architect at Cisco, where he works in the Customer and Partner Experience team to help drive engineering excellence using Nx, Angular, and NgRx.  Outside of work, he enjoys spending time with his family, enjoying various sports, and the outdoors.',
      imageUrl: '/images/conf/ryan-diehl.webp',
      name: 'Ryan Diehl',
      twitter: 'DiehlWithRyan',
    },
    {
      description: 'Senior Engineer II @ Carvana',
      imageUrl: '/images/conf/kennie-davis.webp',
      name: 'Kennie Davis',
      twitter: 'kenniejaydavis',
    },
  ];

  function chunkList<ITEM>(itemList: ITEM[], chunkSize: number): Array<ITEM[]> {
    const result: Array<ITEM[]> = [];
    for (let i = 0; i < itemList.length; i += chunkSize)
      result.push(itemList.slice(i, i + chunkSize));
    return result;
  }
  const rows = chunkList(speakers, 2);
  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      <div className="border-t border-b border-slate-200 dark:border-slate-700">
        <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
          <article className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
            <div className="px-5 py-12 md:pr-12">
              <p className="mb-4">
                Speakers will be announced soon. Stay tuned!
              </p>
            </div>
          </article>
        </div>
      </div>

      {/* {rows.map((row, rowIndex) => (
        <div
          key={'speaker-row--' + rowIndex}
          className="border-b border-slate-200 dark:border-slate-700"
        >
          <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {row.map((speaker) => (
                <div
                  key={speaker.name}
                  className="border-slate-200 py-8 odd:border-b dark:border-slate-700 md:odd:border-r md:odd:border-b-0 md:odd:pr-12 md:even:pl-12"
                >
                  <div className="px-5">
                    <MemberCard
                      imageUrl={speaker.imageUrl}
                      name={speaker.name}
                      description={speaker.description}
                      twitter={speaker.twitter}
                    />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ))} */}
    </div>
  );
}
