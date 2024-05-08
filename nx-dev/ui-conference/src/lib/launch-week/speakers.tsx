import { Member } from '@nx/nx-dev/ui-member-card';
import { Speakers } from '../components/speakers';

export function LaunchWeekSpeakers(): JSX.Element {
  const speakers: Array<Member> = [
    {
      description: `As Sr. Director of Developer Experience at Nx, Juri Strumpflohner helps to shape the evolution of Nx. He loves to break down complex topics and teach them in a simple, digestible form, leveraging his 15+ years of expertise working from backend to frontend systems and consulting as architect for some of the world's biggest companies. Juri is a Google Developer Expert, an international speaker and an Egghead instructor.`,
      imageUrl: '/images/conf/juri-strumpflohner.webp',
      name: 'Juri Strumpflohner',
      twitter: 'juristr',
    },
    {
      description: `Zack is a Google Developer Expert in Angular, and a Senior Engineer and Engineering Manager for Nrwl, living in the desserts of San Tan Valley, Arizona. Zack particularly enjoys teaching other engineers, breaking down problems into manageable pieces, and building awesome stuff.`,
      imageUrl: '/images/conf/zack-derose.webp',
      name: 'Zack DeRose',
      twitter: 'zackderose',
    },
    {
      description: `Meet Craigory, a member on the Nx Core Team for the past two years and the innovator behind the .NET plugin for Nx. Residing in Kentucky, he contributes primarily to Nx's core and plugin support. When he's not immersed in code, Craigory engages in woodworking, electronics, gaming, and cherishes his role as a father. Join him as he explores the intricacies of the new project inference API in Nx, illuminating its flexibility and power.`,
      imageUrl: '/images/conf/craigory-coppola.webp',
      name: 'Craigory Coppola',
      twitter: 'enderagent',
    },
    {
      description: `From the faraway lands of Scotland (but without the Scottish accent), Rareș works at Nrwl.io on NxCloud, helping teams speed up and scale their development practices. He enjoys learning by teaching and has multiple courses on Egghead.io and is a Scotland organiser for Codebar.io.'`,
      imageUrl: '/images/conf/rares-matei.webp',
      name: 'Rareş Matei',
      twitter: '__rares',
    },
    {
      description: `Based in Atlanta, GA, Altan is a senior engineer at Nrwl and works primarily on Nx Cloud. He's passionate about developer experience and helping organizations move quickly. When not building software, you can find him working on his keyboard or on a hike.`,
      imageUrl: '/images/conf/altan-stalker.webp',
      name: 'Altan Stalker',
      twitter: 'StalkAltan',
    },
    {
      description:
        'As Director of Engineering at Nx, James manages our European Nxians and leads our efforts on the Lerna project. He is a prolific open-source contributor, 5x Microsoft MVP, ESLint Core Team Alum, and has worked on a number of projects alongside the TypeScript Team.',
      imageUrl: '/images/conf/james-henry.webp',
      name: 'James Henry',
      twitter: 'MrJamesHenry',
    },
    {
      description: 'Co-Founder/CEO of Nx, and collector of kunekune pigs.',
      imageUrl: '/images/conf/jeff-cross.webp',
      name: 'Jeff Cross',
      twitter: 'jeffbcross',
    },
  ];

  return Speakers(speakers);
}
