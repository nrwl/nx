import { Member } from '@nx/nx-dev/ui-member-card';
import { Speakers } from './components/speakers';

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
      name: 'Lara Newsom (MC)',
      twitter: 'LaraNerdsom',
    },
    {
      description:
        'Philip Fulcher is a senior engineer with Nrwl and an Nx core team member. He works with Fortune 500 clients to modernize their development practices with a monorepo approach. Philip lives in Colorado with his wife (who is much smarter than him) and two great kids.',
      imageUrl: '/images/conf/philip-fulcher.webp',
      name: 'Philip Fulcher (MC)',
      twitter: 'philipjfulcher',
    },
    {
      description:
        'Jonathan Cammisuli is the lead developer on Nx Console, and a key member of the Nx core team. He is also a passionate advocate for the Rust programming language within the core of Nx.',
      imageUrl: '/images/conf/jonathan-cammisuli.webp',
      name: 'Jonathan Cammisuli',
      twitter: 'jcammisuli',
    },
    {
      description: `Max Kless is a senior software engineer at Nx, focussed on building Nx Console and breaking Jon's code.`,
      imageUrl: '/images/conf/max-kless.webp',
      name: 'Max Kless',
      twitter: 'MaxKless',
    },
    {
      description: `As Sr. Director of Developer Experience at Nx, Juri Strumpflohner helps to shape the evolution of Nx. He loves to break down complex topics and teach them in a simple, digestible form, leveraging his 15+ years of expertise working from backend to frontend systems and consulting as architect for some of the world's biggest companies. Juri is a Google Developer Expert, an international speaker and an Egghead instructor.`,
      imageUrl: '/images/conf/juri-strumpflohner.webp',
      name: 'Juri Strumpflohner',
      twitter: 'juristr',
    },
    {
      description: `Simon Critchley is a Senior Software Architect at Nx and has been working on developing Nx Cloud Workflows since he joined in February 2023. In previous roles he's architected large scale web services handling billions of HTTP requests per day.`,
      imageUrl: '/images/conf/simon-critchley.webp',
      name: 'Simon Critchley',
      // twitter: 'MrJamesHenry',
    },
    {
      description:
        'As Director of Engineering at Nx, James manages our European Nxians and leads our efforts on the Lerna project. He is a prolific open-source contributor, 5x Microsoft MVP, ESLint Core Team Alum, and has worked on a number of projects alongside the TypeScript Team.',
      imageUrl: '/images/conf/james-henry.webp',
      name: 'James Henry',
      twitter: 'MrJamesHenry',
    },
    {
      description: `Miro is a core member of the Nx team, helping companies build scalable and performant applications. He enjoys sharing with the community so much that he co-founded Angular Austria Association and co-organizes the Vienna JS and ArmadaJS. 
        Despite the name, he is not a visual collaboration platform.`,
      imageUrl: '/images/conf/miroslav-jonas.webp',
      name: 'Miroslav Jonas',
      twitter: 'meeroslav',
    },
    {
      description:
        'Senior Engineer at Nx, open source contributor, GDE for Angular/Web Technologies/Google Maps platform, WTM Ambassador, AngularAthens meetup co-founder. Mentoring women into tech, speaking about the cool things I do, climbing mountains and serving cats for life.',
      imageUrl: '/images/conf/katerina-skroumpelou.webp',
      name: 'Katerina Skroumpelou',
      twitter: 'psybercity',
    },
    {
      description: `Isaac is an Architect at Nx. He loves introducing devs to the ways that Nx can improve their software development process. He writes docs on nx.dev, gives workshops and joins forces with Nx Champions.
      Isaac has never been to the moon, but he lives in Ohio - where Neil Armstrong was born.`,
      imageUrl: '/images/conf/isaac-mann.webp',
      name: 'Isaac Mann',
      twitter: 'MannIsaac',
    },
    {
      description: `Brandon is an OSS Advocate, focused on community engagement, content creation, and collaboration. He enjoys learning new things, helping other developers be successful, speaking at conferences, and contributing to open source. He is a GDE, technical writer, maintainer of the NgRx project building libraries for reactive Angular applications, and creator of the AnalogJS meta-framework.`,
      imageUrl: '/images/conf/brandon-roberts.webp',
      name: 'Brandon Roberts',
      twitter: 'brandontroberts',
    },
    {
      description: `Meet Craigory, a member on the Nx Core Team for the past two years and the innovator behind the .NET plugin for Nx. Residing in Kentucky, he contributes primarily to Nx's core and plugin support. When he's not immersed in code, Craigory engages in woodworking, electronics, gaming, and cherishes his role as a father. Join him as he explores the intricacies of the new project inference API in Nx, illuminating its flexibility and power.`,
      imageUrl: '/images/conf/craigory-coppola.webp',
      name: 'Craigory Coppola',
      twitter: 'enderagent',
    },
    {
      description: `Johanna is a software architect, problem-solver and science groupie. She has a firm belief that people are always the most interesting component of any system, and a fascination with how we learn and why we often tend to guard too closely the information we acquire.`,
      imageUrl: '/images/conf/johanna-pearce.webp',
      name: 'Johanna Pearce',
      twitter: 'jhannapearce',
    },
    {
      description: `Michael Hladky is a Google Developer Expert (GDE), Microsoft MVP, Nx Champion, trainer, and consultant with a focus on Angular and RxJS. For years he has been helping companies and developers to set up scalable architectures and performant processes enabling teams to keep up with state-of-the-art development. A vibrant member of the tech community, he organizes multiple community events and workshops each year to give back.`,
      imageUrl: '/images/conf/michael-hladky.webp',
      name: 'Michael Hladky',
      twitter: 'Michael_Hladky',
    },
    {
      description: `Adrian is a Chicagoland-based Senior Software Engineer at Cisco who loves to focus on developer experience. He helped shape the Cisco CPX enterprise solution since first migrating it to an Nx monorepo and has been involved in most efforts around Nx utilization and DX, especially for linting and CI/CD. When he isn't dabbling with software, he's out hiking, training Muay Thai, or reading a novel by James Rollins.`,
      imageUrl: '/images/conf/adrian-baran.webp',
      name: 'Adrian Baran',
    },
  ];

  return Speakers(speakers);
}
