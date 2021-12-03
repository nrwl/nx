import Link from 'next/link';

export function FeatureList() {
  const data = [
    {
      title: 'Monorepos',
      link: '#monorepos',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 absolute left-1 top-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z"
          />
        </svg>
      ),
      items: [
        'Smart rebuilds of affected projects',
        'Distributed task execution & computation caching',
        'Code sharing and ownership management',
      ],
    },
    {
      title: 'Integrated DX',
      link: '#integrated-dx',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 absolute left-1 top-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M14 10l-2 1m0 0l-2-1m2 1v2.5M20 7l-2 1m2-1l-2-1m2 1v2.5M14 4l-2-1-2 1M4 7l2-1M4 7l2 1M4 7v2.5M12 21l-2-1m2 1l2-1m-2 1v-2.5M6 18l-2-1v-2.5M18 18l2-1v-2.5"
          />
        </svg>
      ),
      items: [
        'High-quality editor plugins & GitHub apps',
        'Powerful code generators',
        'Interactive workspace visualizations',
      ],
    },
    {
      title: 'Ecosystem',
      link: '#ecosystem',
      icon: (
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-6 w-6 absolute left-1 top-1"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4.318 6.318a4.5 4.5 0 000 6.364L12 20.364l7.682-7.682a4.5 4.5 0 00-6.364-6.364L12 7.636l-1.318-1.318a4.5 4.5 0 00-6.364 0z"
          />
        </svg>
      ),
      items: [
        'Rich plugin ecosystem',
        'Consistent dev experience for any framework',
        'Automatic upgrade to latest versions of all frameworks and tools',
      ],
    },
  ];

  return (
    <div className="mt-8">
      <div className="max-w-screen xl:max-w-screen-xl mx-auto px-5 py-5">
        <div className="my-4 flex flex-wrap -m-4">
          {data.map((tile) => (
            <div key={tile.link} className="p-4 lg:w-1/3 md:w-1/2 w-full">
              <Link href={tile.link}>
                <div className="h-full px-4 py-8 rounded-lg border border-gray-50 shadow flex flex-col relative overflow-hidden cursor-pointer group hover:border-blue-nx-dark transition">
                  <h2 className="text-center text-xl sm:text-2xl lg:text-2xl leading-none font-extrabold tracking-tight mb-4 relative text-blue-nx-dark">
                    {tile.icon}
                    {tile.title}
                  </h2>
                  {tile.items.map((item, index) => (
                    <p key={index} className="flex items-start mt-4">
                      <span className="w-4 h-4 mr-2 mt-1 inline-flex items-center justify-center text-blue-nx-dark">
                        <svg
                          xmlns="http://www.w3.org/2000/svg"
                          className="h-6 w-6"
                          fill="none"
                          viewBox="0 0 24 24"
                          stroke="currentColor"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M9 5l7 7-7 7"
                          />
                        </svg>
                      </span>
                      {item}
                    </p>
                  ))}
                </div>
              </Link>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

export default FeatureList;
