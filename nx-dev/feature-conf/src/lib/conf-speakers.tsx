import { Member, MemberCard } from '@nrwl/nx-dev/ui/member-card';

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
      description: 'Coming soon.',
      imageUrl: '/images/conf/isaac-mann.webp',
      name: 'Isaac Mann',
      twitter: 'MannIsaac',
    },
    {
      description: 'Coming soon.',
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
        "Diana Rodriguez is a Full Stack Developer & DevOps lover of all things web and cloud! With 20+ years experience and a strong background in back end and infrastructure Diana likes to bring together the best of both worlds. She's super enthusiastic about encouraging people to start a career in development and a fan of Python, IoT, Automation and things to nerd about.",
      imageUrl: '/images/conf/diana-rodriguez.webp',
      name: 'Diana Rodriguez',
      twitter: 'cotufa82',
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
        'Nathan Walker has enjoyed the opportunity to work in the web/mobile app development arena for over 15 years. His varied background rooted in the world of design and the arts provides him a unique approach to problem solving. In 2017, he co-founded nStudio to help work with others to achieve their creative ideas.',
      imageUrl: '/images/conf/nathan-walker.webp',
      name: 'Nathan Walker',
      twitter: 'wwwalkerrun',
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
                  className="py-8 md:odd:pr-12 md:even:pl-12 odd:border-b md:odd:border-r md:odd:border-l-0 border-gray-600"
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
