import Image from 'next/image';

export interface Sponsor {
  imageUrl: string;
  name: string;
  description: string;
  linkTarget: string;
}
export function SponsorCard(data: Sponsor) {
  return (
    <figure className="py-6 h-full grid grid-cols-1 md:grid-cols-3 gap-12 align-center items-center justify-center">
      <div className="rounded-full md:col-span-1">
        <a
          className="cursor-pointer"
          href={data.linkTarget}
          target="_blank"
          rel="nofollow"
        >
          <Image src={data.imageUrl} alt={data.name} width={130} height={130} />
        </a>
      </div>
      <div className="md:col-span-2">
        <h5 className="mb-3 font-input-mono">{data.name}</h5>
        <p className="text-gray-400">{data.description}</p>
      </div>
    </figure>
  );
}
