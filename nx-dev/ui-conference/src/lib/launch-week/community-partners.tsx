export function LaunchNxCommunityPartners(): JSX.Element {
  const partners: Array<{
    imageUrl: string;
    name: string;
    linkTarget: string;
  }> = [
    {
      imageUrl: '/images/launch-nx/stackblitz.png',
      name: 'Stackblitz',
      linkTarget: 'https://stackblitz.com/',
    },
    {
      imageUrl: '/images/launch-nx/ng-conf.webp',
      name: 'NG-Conf',
      linkTarget: 'https://ng-conf.org/',
    },
    {
      imageUrl: '/images/launch-nx/rxjs-logo.png',
      name: 'RxJS',
      linkTarget: 'https://rxjs.dev/',
    },
    {
      imageUrl: '/images/launch-nx/thisdot.png',
      name: 'ThisDot',
      linkTarget: 'https://www.thisdot.co/',
    },
    {
      imageUrl: '/images/launch-nx/rspack.png',
      name: 'Rspack',
      linkTarget: 'https://www.rspack.dev',
    },
    {
      imageUrl: '/images/launch-nx/storybook.svg',
      name: 'Storybook',
      linkTarget: 'https://storybook.js.org/',
    },
    {
      imageUrl: '/images/launch-nx/chromatic.png',
      name: 'Chromatic',
      linkTarget: 'https://www.chromatic.com/',
    },
    {
      imageUrl: '/images/launch-nx/epicweb.svg',
      name: 'Epic Web',
      linkTarget: 'https://www.epicweb.dev/',
    },
    {
      imageUrl: '/images/launch-nx/nuxt-logo.svg',
      name: 'Nuxt',
      linkTarget: 'https://nuxt.com/',
    },
    {
      imageUrl: '/images/launch-nx/viteconf.svg',
      name: 'ViteConf',
      linkTarget: 'https://viteconf.org ',
    },
  ];

  return (
    <div className="border-t border-slate-200 dark:border-slate-700">
      <div className="mx-auto max-w-7xl py-6">
        <div className="mx-auto mt-10 grid max-w-lg grid-cols-1 items-center gap-8 px-6 sm:max-w-xl md:grid-cols-2 lg:mx-0 lg:max-w-none lg:grid-cols-3">
          {partners.map((partner) => (
            <a
              key={partner.name}
              className="flex h-full w-full justify-center rounded-lg bg-white p-8"
              href={partner.linkTarget}
            >
              <img
                key={partner.name}
                className={'max-h-12 max-w-[220px] object-contain'}
                src={partner.imageUrl}
                alt={partner.name}
              />
            </a>
          ))}
        </div>
      </div>
    </div>
  );
}
