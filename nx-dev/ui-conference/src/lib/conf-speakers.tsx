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
      description: 'TBD',
      imageUrl: '/images/conf/jack-hsu.webp',
      name: 'Jack Hsu',
      twitter: 'jay_soo',
    },
    {
      description: 'TBD',
      imageUrl: '/images/conf/altan-stalker.webp',
      name: 'Altan Stalker',
      twitter: 'altan',
    },
    {
      description: 'TBD',
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
      description: 'TBD',
      imageUrl: '/images/conf/rares-matei.webp',
      name: 'Rareş Matei',
      twitter: '__rares',
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
