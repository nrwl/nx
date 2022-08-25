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
