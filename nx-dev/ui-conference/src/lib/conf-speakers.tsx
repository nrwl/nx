import { Member, MemberCard } from '@nrwl/nx-dev/ui-member-card';

export function ConfSpeakers(): JSX.Element {
  const speakers: Array<Member> = [
    {
      description:
        'Jeff Cross is a co-founder and Angular consultant at nrwl.io, and is the former tech lead of the Angular Mobile Team at Google.',
      imageUrl: '/images/conf/jeff-cross.webp',
      name: 'Jeff Cross',
      twitter: 'jeffbcross',
    },
    {
      description:
        'Nrwlio co-founder, ex-Googler. Work on dev tools for TS/JS. Nx and Nx Cloud creator. Calligraphy and philosophy enthusiast. Stoic.',
      imageUrl: '/images/conf/victor-savkin.webp',
      name: 'Victor Savkin',
      twitter: 'victorsavkin',
    },
    {
      description:
        "Colum Ferry is a Senior Software Engineer at Nrwl, working on the Angular Plugin for Nx. He's interested in architectural patterns with Angular and, more particularly, in achieving a Micro Frontend Architecture with Angular. Colum is a married father of two rambunctious kids and he's lately turned into a huge Formula 1 fan!",
      imageUrl: '/images/conf/colum-ferry.webp',
      name: 'Colum Ferry',
      twitter: 'FerryColum',
    },
    {
      description:
        "Juri Strumpflohner lives in the very northern part of Italy and is currently working as a JavaScript Architect and Engineering Manager at Nrwl, where he consults for some of the world's biggest companies around the globe. Juri is a Google Developer Expert in Web Technologies & Angular, speaks at international conferences, teaches on Egghead.io. He's also a core member of Nx.",
      imageUrl: '/images/conf/juri-strumpflohner.webp',
      name: 'Juri Strumpflohner',
      twitter: 'juristr',
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
        'Philip Fulcher is a senior engineer with Nrwl and an Nx core team member. He works with Fortune 500 clients to modernize their development practices with a monorepo approach. Philip lives in Colorado with his wife (who is much smarter than him) and two great kids.',
      imageUrl: '/images/conf/philip-fulcher.webp',
      name: 'Philip Fulcher',
      twitter: 'PhilipJFulcher',
    },
    {
      description:
        'Jo Hanna is a senior software engineer, problem-solver and science groupie. She has a firm belief that people are always the most interesting component of any system, and a fascination with how we learn and why we often tend to guard too closely the information we acquire.',
      imageUrl: '/images/conf/jo-hanna-pearce.webp',
      name: 'Jo Hanna Pearce',
      twitter: 'jhannapearce',
    },
    {
      description:
        'Craigory is an engineer with Nrwl on the Nx core team. Before joining Nrwl, Craigory created the nx-dotnet plugin to integrate C# and .NET into Nx in monorepos alongside front end code.',
      imageUrl: '/images/conf/craigory-coppola.webp',
      name: 'Craigory Coppola',
      twitter: 'enderagent',
    },
    {
      description:
        'Jason is an architect at Nrwl and a part of the Nx Core Team. He works with Fortune 500 companies across different industries to enable them to develop like Google, Microsoft, and Facebook. Jason is also an enthusiast of board games and mechanical keyboards.',
      imageUrl: '/images/conf/jason-jeans.webp',
      name: 'Jason Jean',
      twitter: 'frozenpandaz',
    },
    {
      description:
        'Miro is an engineer at Nrwl.io and a member of the Nx Core team. He enjoys sharing with the community, speaking, contributing to open source, and organizing events. Miro is co-founder of Angular Austria and co-organizer of Angular Vienna and ViennaJS meetups.',
      imageUrl: '/images/conf/miroslav-jonas.webp',
      name: 'Miroslav Jonas',
      twitter: 'meeroslav',
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
    <div className="border-t border-gray-600">
      {rows.map((row, rowIndex) => (
        <div
          key={'speaker-row--' + rowIndex}
          className="border-b border-gray-600"
        >
          <div className="mx-auto max-w-screen-lg text-white xl:max-w-screen-xl">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {row.map((speaker) => (
                <div
                  key={speaker.name}
                  className="border-gray-600 py-8 odd:border-b md:odd:border-r md:odd:border-b-0 md:odd:pr-12 md:even:pl-12"
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
      ))}
    </div>
  );
}
