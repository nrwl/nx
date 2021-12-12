import { Sponsor, SponsorCard } from '@nrwl/nx-dev/ui-sponsor-card';
import cx from 'classnames';

export function ConfSponsors(): JSX.Element {
  const sponsorListByLevel: Record<string, Array<Sponsor>> = {
    'Tier level': [
      {
        description:
          "Brainly is the world's largest online learning platform where students and parents go from questioning to understanding. Students connect their peers and experts to both receive and offer help with homework problems and questions through Community Q&A, Brainly Tutor & Math Solve",
        imageUrl: '/images/conf/brainlylogo.svg',
        name: 'Brainly',
        linkTarget: 'https://careers.brainly.com',
      },
      {
        description:
          'Briebug provides high-performance team augmentation services to enterprise software executives and their teams that streamline their environment, accelerate the release of digital products, and guarantee their success.',
        imageUrl: '/images/conf/briebuglogo.svg',
        name: 'Briebug',
        linkTarget:
          'https://briebug.com/?utm_source=Nx+Conf&utm_medium=Web&utm_campaign=Nx+Conf',
      },
      {
        description:
          'Cisco helps seize the opportunities of tomorrow by proving that amazing things can happen when you connect the unconnected. As Customer & Partner Experience Engineering, we deliver the CX and PX Cloud that unifies our Customer Experience and serves as the single Customer entry point to Cisco. We accelerate our customers’ success and profitable growth for Cisco and our partners by delivering simple, secure, innovate, and agile scaling engines.',
        imageUrl: '/images/conf/ciscologo.webp',
        name: 'Cisco',
        linkTarget: 'https://www.cisco.com',
      },
      {
        description:
          'Heroes of enterprise Angular development. Looking for the best Angular developers on earth? The heroes at HeroDevs are here for you. These heroes helped create the Angular CLI, Angular Universal, Scully, ng-conf, extended AngularJS support, and Angular itself. If you need a hero developer, look no further.',
        imageUrl: '/images/conf/herodevslogo.svg',
        name: 'Hero.dev',
        linkTarget: 'https://hero.dev',
      },
      {
        description:
          'Use Ionic to build beautiful, fast, cross-platform apps using web technologies like HTML, CSS, JavaScript, and your framework of choice — React, Angular, or Vue. Use native device APIs with Ionic and deploy web, iOS, Android, and desktop apps from a single codebase.',
        imageUrl: '/images/conf/ioniclogo.svg',
        name: 'Ionic',
        linkTarget: 'https://ionicframework.com',
      },
      {
        description:
          'Oasis Digital helps enterprise teams optimize and scale. We specialize in web/fullstack systems including Angular and Nx in depth.',
        imageUrl: '/images/conf/oasisdigitallogo.svg',
        name: 'Oasis Digital',
        linkTarget: 'https://oasisdigital.com',
      },
      {
        description:
          "Thinkster makes the world's best development tutorials, combining great teachers with educational science to teach you 5 to 10 times faster than any other method.",
        imageUrl: '/images/conf/thinksterlogo.webp',
        name: 'Thinkster',
        linkTarget: 'https://thinkster.io',
      },
      {
        description:
          'VMware is delivering the multi-cloud platform for all applications, enabling the digital innovation and enterprise control customers need. We build one of the largest enterprise front-end applications using Angular, Typescript, Nrwl, and Cypress. Join us and make an impact!',
        imageUrl: '/images/conf/vmwarelogo.svg',
        name: 'VMware',
        linkTarget: 'https://www.vmware.com',
      },
      {
        description:
          'Dive into JavaScript and Web development stories with Web Rush, a weekly podcast where we tackle the challenges facing Web developers today and invite expert guests on the show to share their experience solving concrete problems while building real Web applications.',
        imageUrl: '/images/conf/webrushlogo.svg',
        name: 'WebRush',
        linkTarget: 'https://webrush.io',
      },
      {
        description:
          'Our AngularJS experts will help you identify the best path forward for supporting your AngularJS projects. Don’t wait for Google’s AngularJS support to end, keep your digital assets protected with XLTS for AngularJS.',
        imageUrl: '/images/conf/xltslogo.webp',
        name: 'XLTS.dev',
        linkTarget: 'https://xlts.dev/angularjs',
      },
    ],
  };
  const sponsorLevelList = Object.keys(sponsorListByLevel);

  function chunkList<ITEM>(itemList: ITEM[], chunkSize: number): Array<ITEM[]> {
    const result: Array<ITEM[]> = [];
    for (let i = 0; i < itemList.length; i += chunkSize)
      result.push(itemList.slice(i, i + chunkSize));
    return result;
  }
  return (
    <div className="border-t border-gray-600">
      {sponsorLevelList.map((key, levelIndex) => (
        <div key={'sponsor-level--' + key}>
          {/*<div className="border-b border-gray-600">*/}
          {/*  <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto text-white">*/}
          {/*    <h4 className="my-8 px-5 text-lg font-input-mono">{key}</h4>*/}
          {/*  </div>*/}
          {/*</div>*/}
          {chunkList(sponsorListByLevel[key], 2).map((row, rowIndex) => (
            <div
              key={'speaker-row--' + rowIndex}
              className={cx(
                'border-b border-gray-600',
                sponsorLevelList.length === levelIndex + 1 && 'border-b'
              )}
            >
              <div className="max-w-screen-lg xl:max-w-screen-xl mx-auto text-white">
                <div className="grid grid-cols-1 md:grid-cols-2">
                  {row.map((speaker) => (
                    <div
                      key={speaker.name}
                      className="py-8 md:odd:pr-12 md:even:pl-12 odd:border-b md:odd:border-r md:odd:border-b-0 border-gray-600"
                    >
                      <div className="px-5 h-full">
                        <SponsorCard
                          imageUrl={speaker.imageUrl}
                          name={speaker.name}
                          description={speaker.description}
                          linkTarget={speaker.linkTarget}
                        />
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          ))}
        </div>
      ))}
    </div>
  );
}
