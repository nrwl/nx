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
        'From the faraway lands of Scotland (but without the Scottish accent), Rares works at Nrwl on NxCloud, helping teams speed up and scale their development. He enjoys learning by teaching and has Egghead.io courses on TypeScript and Reactive Programming.',
      imageUrl: '/images/conf/rares-matei.webp',
      name: 'Rares Matei',
      twitter: '__rares',
    },
    {
      description:
        "Trainer, consultant and programming architect with focus on Angular. Google Developer Expert (GDE) and Trusted Collaborator in the Angular team who writes for O'Reilly, the German Java Magazine, and windows.developer. Regularly speaks at conferences.",
      imageUrl: '/images/conf/manfred-steyer.webp',
      name: 'Manfred Steyer',
      twitter: 'ManfredSteyer',
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
        'Yvonne Allen is an Angular GDE and who has a passion for speaking on what she calls "the topics in the in between" at Conferences and meetups. Yvonne is a co-organizer for GDG Atlanta and a member of Women Who Code. She also has a passion for advising and mentoring new developers and is an open source contributor.',
      imageUrl: '/images/conf/yvonne-allen.webp',
      name: 'Yvonne Allen',
      twitter: 'yallen011',
    },
    {
      description:
        'Nathan Walker has enjoyed the opportunity to work in the web/mobile app development arena for over 15 years. His varied background rooted in the world of design and the arts provides him a unique approach to problem solving. In 2017, he co-founded nStudio to help work with others to achieve their creative ideas.',
      imageUrl: '/images/conf/nathan-walker.webp',
      name: 'Nathan Walker',
      twitter: 'wwwalkerrun',
    },
    {
      description:
        "Juri Strumpflohner lives in the very northern part of Italy and is currently working as a JavaScript Architect and Engineering Manager at Nrwl, where he consults for some of the world's biggest companies around the globe. Juri is a Google Developer Expert in Web Technologies & Angular, speaks at international conferences, teaches on Egghead.io. He's also a core member of Nx.",
      imageUrl: '/images/conf/juri-strumpflohner.webp',
      name: 'Juri Strumpflohner',
      twitter: 'juristr',
    },
    {
      description: 'Kirils is a Software Engineer at Nrwl, working on Nx.',
      imageUrl: '/images/conf/kirils-ladovs.webp',
      name: 'Kirils Ladovs',
      twitter: 'kirjai',
    },
    {
      description:
        'Based in Atlanta, GA, Altan is an engineer on the Nx Cloud team. He enjoys web tech, mechanical keyboards, and drone photography.',
      imageUrl: '/images/conf/altan-stalker.webp',
      name: 'Altan Stalker',
      twitter: 'StalkAltan',
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
        'Software Engineer at Nrwl, Nx core team, GDE for Angular/Web Technologies/Google Maps platform, AngularAthens meetup and RevApp co-founder. Mentoring women into tech, speaking about the cool things I do, climbing mountains and serving cats for life.',
      imageUrl: '/images/conf/katerina-skroumpelou.webp',
      name: 'Katerina Skroumpelou',
      twitter: 'psybercity',
    },
    {
      description:
        'Zack is a Senior Engineer and Engineering Manager at Nrwl, as well as a Google Developer Expert for Angular. When not in front of a computer screen, Zack enjoys a robust family life at scale, with his wife and 6 kids in San Tan Valley, AZ.',
      imageUrl: '/images/conf/zack-derose.webp',
      name: 'Zack DeRose',
      twitter: 'zackderose',
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
        'Craigory is an engineer with Nrwl on the Nx core team. Before joining Nrwl, Craigory created the nx-dotnet plugin to integrate C# and .NET into Nx in monorepos alongside front end code.',
      imageUrl: '/images/conf/craigory-coppola.webp',
      name: 'Craigory Coppola',
      twitter: 'enderagent',
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
          <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto text-white">
            <div className="grid grid-cols-1 md:grid-cols-2">
              {row.map((speaker) => (
                <div
                  key={speaker.name}
                  className="py-8 md:odd:pr-12 md:even:pl-12 odd:border-b md:odd:border-r md:odd:border-b-0 border-gray-600"
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
