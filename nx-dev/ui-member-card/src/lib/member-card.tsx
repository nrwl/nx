import Image from 'next/image';

export interface Member {
  imageUrl?: string;
  name: string;
  description: string;
  x?: string;
}

export function MemberCard(data: Member): JSX.Element {
  return (
    <figure className="align-center grid grid-cols-5 items-center justify-center gap-12 py-6 md:grid-cols-3">
      <div className="col-span-2 rounded-full md:col-span-1">
        {data.imageUrl && (
          <Image src={data.imageUrl} alt={data.name} width={180} height={180} />
        )}
      </div>
      <div className="col-span-3 md:col-span-2">
        <h5 className="font-input-mono mb-3">{data.name}</h5>
        <p>{data.description}</p>
        {data.x ? (
          <a
            className="font-input-mono mt-6 block"
            href={'https://x.com/' + data.x}
            target="_blank"
            rel="noreferrer"
          >
            @{data.x}
          </a>
        ) : null}
      </div>
    </figure>
  );
}
