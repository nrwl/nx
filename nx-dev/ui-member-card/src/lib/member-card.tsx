import Image from 'next/image';

export interface Member {
  imageUrl: string;
  name: string;
  description: string;
  twitter?: string;
}

export function MemberCard(data: Member): JSX.Element {
  return (
    <figure className="align-center grid grid-cols-5 items-center justify-center gap-12 py-6 md:grid-cols-3">
      <div className="col-span-2 rounded-full md:col-span-1">
        <Image
          src={data.imageUrl}
          alt={data.name}
          width={180}
          height={180}
          layout={'responsive'}
        />
      </div>
      <div className="col-span-3 md:col-span-2">
        <h5 className="font-input-mono mb-3">{data.name}</h5>
        <p className="text-gray-400">{data.description}</p>
        {data.twitter ? (
          <a
            className="font-input-mono mt-6 block"
            href={'https://twitter.com/' + data.twitter}
            target="_blank"
            rel="nofollow"
          >
            @{data.twitter}
          </a>
        ) : null}
      </div>
    </figure>
  );
}
