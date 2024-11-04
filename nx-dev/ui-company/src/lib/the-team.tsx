import { SectionHeading } from '@nx/nx-dev/ui-common';

const teamMembers = [
  {
    name: 'Altan stalker',
    title: 'Senior Engineer',
    imageUrl: 'altan-stalker.avif',
  },
  {
    name: 'Austin Fahsl',
    title: 'Senior Engineer',
    imageUrl: 'austin-fahsl.avif',
  },
  {
    name: 'Benjamin Cabanes',
    title: 'Architect',
    imageUrl: 'benjamin-cabanes.avif',
  },
  {
    name: 'Caitlin Cashin',
    title: 'Developer Marketing Manager',
    imageUrl: 'caitlin-cashin.avif',
  },
  {
    name: 'Caleb Ukle',
    title: 'Senior Engineer',
    imageUrl: 'caleb-ukle.avif',
  },
  {
    name: 'Chau Tran',
    title: 'Senior Engineer',
    imageUrl: 'chau-tran.avif',
  },
  {
    name: 'Colum Ferry',
    title: 'Senior Engineer',
    imageUrl: 'colum-ferry.avif',
  },
  {
    name: 'Cory Henderson',
    title: 'Director of Revenue Operations',
    imageUrl: 'cory-henderson.avif',
  },
  {
    name: 'Craigory Coppola',
    title: 'Senior Engineer',
    imageUrl: 'craigory-coppola.avif',
  },
  {
    name: 'Emily Xiong',
    title: 'Senior Engineer',
    imageUrl: 'emily-xiong.avif',
  },
  {
    name: 'Drew Romney',
    title: 'VP of Finance',
    imageUrl: 'drew-romney.avif',
  },
  {
    name: 'Heidi Grütter',
    title: 'Director of Product Marketing',
    imageUrl: 'heidi-grutter.avif',
  },
  {
    name: 'Isaac Mann',
    title: 'Architect',
    imageUrl: 'isaac-mann.avif',
  },
  {
    name: 'Jack Butler',
    title: 'Account Exec',
    imageUrl: 'jack-butler.avif',
  },
  {
    name: 'Jack Hsu',
    title: 'Architect',
    imageUrl: 'jack-hsu.avif',
  },
  {
    name: 'James Henry',
    title: 'Director of Engineering',
    imageUrl: 'james-henry.avif',
  },
  {
    name: 'Jason Jean',
    title: 'Architect',
    imageUrl: 'jason-jean.avif',
  },
  {
    name: 'Jimmy LaBonte',
    title: 'Account Executive',
    imageUrl: 'jimmy-labonte.avif',
  },
  {
    name: 'Joe Johnson',
    title: 'Director of Professional Services',
    imageUrl: 'joe-johnson.avif',
  },
  {
    name: 'Johanna Pearce',
    title: 'Architect',
    imageUrl: 'johanna-pearce.avif',
  },
  {
    name: 'Jonathan Cammisuli',
    title: 'Architect',
    imageUrl: 'jonathan-cammisuli.avif',
  },
  {
    name: 'Juri Strumpflohner',
    title: 'Director of Developer Experience',
    imageUrl: 'juri-strumpflohner.avif',
  },
  {
    name: 'Katerina Skroumpelou',
    title: 'Senior Engineer',
    imageUrl: 'katerina-skroumpelou.avif',
  },
  {
    name: 'Leosvel Perez Espinosa',
    title: 'Senior Engineer',
    imageUrl: 'leosvel-perez-espinosa.avif',
  },
  {
    name: 'Louie Weng',
    title: 'Software Engineer',
    imageUrl: 'louie-weng.avif',
  },
  {
    name: 'Max Kless',
    title: 'Senior Engineer',
    imageUrl: 'max-kless.avif',
  },
  {
    name: 'Mark Lindsey',
    title: 'Senior Engineer',
    imageUrl: 'mark-lindsey.avif',
  },
  {
    name: 'Mike Hartington',
    title: 'Director of Developer Relations',
    imageUrl: 'mike-hartington.avif',
  },
  {
    name: 'Miroslav Jonas',
    title: 'Senior Engineer',
    imageUrl: 'miroslav-jonas.avif',
  },
  {
    name: 'Nicholas Cunningham',
    title: 'Senior Engineer',
    imageUrl: 'nicholas-cunningham.avif',
  },
  {
    name: 'Nicole Oliver',
    title: 'Senior Engineer',
    imageUrl: 'nicole-oliver.avif',
  },
  {
    name: 'Patrick Mariglia',
    title: 'Software Engineer',
    imageUrl: 'patrick-mariglia.avif',
  },
  {
    name: 'Philip Fulcher',
    title: 'Senior Engineer',
    imageUrl: 'philip-fulcher.avif',
  },
  {
    name: 'Rares Matei',
    title: 'Architect',
    imageUrl: 'rares-matei.avif',
  },
  {
    name: 'Steve Pentland',
    title: 'Senior Engineer',
    imageUrl: 'steve-pentland.avif',
  },
  {
    name: 'Whitney Loy',
    title: 'Operations Manager',
    imageUrl: 'whitney-loy.avif',
  },
  {
    name: 'Zack DeRose',
    title: 'Senior Engineer',
    imageUrl: 'zack-derose.avif',
  },
];
export function TheTeam(): JSX.Element {
  return (
    <section>
      <div className="max-w-7x1 mx-auto px-4 text-center sm:px-6 lg:px-8">
        <div className="space-y-8 sm:space-y-12">
          <div className="space-y-5 sm:mx-auto sm:max-w-xl sm:space-y-4 lg:max-w-5xl">
            <SectionHeading as="h2" variant="title">
              The Team
            </SectionHeading>
          </div>
          <ul className="mx-auto grid grid-cols-2 gap-x-4 gap-y-8 sm:grid-cols-4 md:gap-x-6 lg:max-w-5xl lg:gap-x-8 lg:gap-y-12 xl:grid-cols-4">
            {teamMembers.map((teamMember, _) => {
              return (
                <li key={teamMember.name}>
                  <div className="space-y-4">
                    <img
                      loading="lazy"
                      src={`/images/team/${teamMember.imageUrl}`}
                      alt={teamMember.name}
                      className="mx-auto h-20 w-20 rounded-full lg:h-24 lg:w-24"
                    />
                    <div className="space-y-2">
                      <div className="text-xs font-medium lg:text-sm">
                        <h3>{teamMember.name}</h3>
                        <p className="text-slate-400 dark:text-slate-600">
                          {teamMember.title}
                        </p>
                      </div>
                    </div>
                  </div>
                </li>
              );
            })}
          </ul>
        </div>
      </div>
    </section>
  );
}
