import Image from 'next/image';

export interface Sponsor {
  imageUrl: string;
  name: string;
  description: string;
  linkTarget: string;
}
export function SponsorCard(data: Sponsor) {
  return (
    <figure className="align-center grid h-full grid-cols-1 items-center justify-center gap-12 py-6 md:grid-cols-3">
      <div className="rounded-full md:col-span-1">
        <a
          className="cursor-pointer"
          href={data.linkTarget}
          target="_blank"
          rel="noreferrer"
        >
          <Image src={data.imageUrl} alt={data.name} width={130} height={130} />
        </a>
      </div>
      <div className="md:col-span-2">
        <h5 className="font-input-mono mb-3">{data.name}</h5>
        <p className="text-gray-400">{data.description}</p>
      </div>
    </figure>
  );
}
