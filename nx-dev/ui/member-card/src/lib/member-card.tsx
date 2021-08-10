import Image from 'next/image';

export interface Member {
  imageUrl: string;
  name: string;
  description: string;
  twitter?: string;
}

export function MemberCard(data: Member): JSX.Element {
  return (
    <figure className="py-6 grid grid-cols-5 md:grid-cols-3 gap-12 align-center items-center justify-center">
      <div className="rounded-full col-span-2 md:col-span-1">
        <Image
          src={data.imageUrl}
          alt={data.name}
          width={180}
          height={180}
          layout={'responsive'}
        />
      </div>
      <div className="col-span-3 md:col-span-2">
        <h5 className="mb-3 font-input-mono">{data.name}</h5>
        <p className="text-gray-400">{data.description}</p>
        {data.twitter ? (
          <a
            className="mt-6 block font-input-mono"
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
