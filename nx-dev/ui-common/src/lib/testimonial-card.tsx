import { ReactComponentElement } from 'react';

interface Testimonial {
  author: string;
  title: string;
  content: string;
  imageUrl: string;
  link: string;
}

export function TestimonialCard({
  data,
}: {
  data: Testimonial;
}): ReactComponentElement<any> {
  return (
    <figure className="focus-within:ring-blue-nx-base relative flex flex-col-reverse rounded-lg border border-gray-300 bg-white p-6 text-sm shadow-sm transition focus-within:ring-2 focus-within:ring-offset-2  hover:bg-gray-50">
      <blockquote className="mt-6 text-slate-500">
        <p>{data.content}</p>
      </blockquote>
      <figcaption className="flex items-center space-x-4">
        <img
          src={data.imageUrl}
          alt={data.author}
          className="h-12 w-12 flex-none rounded-full object-cover"
          loading="lazy"
        />
        <div className="flex-auto">
          <div className="font-semibold text-slate-700">
            <a target="_blank" rel="noreferrer" href={data.link}>
              <span className="absolute inset-0"></span>
              {data.author}
            </a>
          </div>
          <div className="mt-0.5">{data.title}</div>
        </div>
      </figcaption>
    </figure>
  );
}

export default TestimonialCard;
