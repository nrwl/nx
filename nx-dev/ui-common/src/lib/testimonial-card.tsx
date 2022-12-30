interface Testimonial {
  author: string;
  title: string;
  content: string;
  imageUrl: string;
  link: string;
}

export function TestimonialCard({ data }: { data: Testimonial }): JSX.Element {
  return (
    <figure className="relative flex flex-col-reverse rounded-lg border border-slate-200 bg-white/40 p-4 text-sm shadow-sm  transition focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 hover:bg-white dark:border-slate-800/40 dark:bg-slate-800/60 dark:hover:bg-slate-800">
      <blockquote className="mt-4 text-slate-600 dark:text-slate-400">
        <p>{data.content}</p>
      </blockquote>
      <figcaption className="flex items-center space-x-4">
        <img
          src={data.imageUrl}
          alt={data.author}
          className="h-12 w-12 flex-none rounded-full border border-slate-200 object-cover dark:border-slate-800/40"
          loading="lazy"
        />
        <div className="flex-auto">
          <div className="font-semibold text-slate-500 dark:text-slate-300">
            <a target="_blank" rel="noreferrer" href={data.link}>
              <span className="absolute inset-0"></span>
              {data.author}
            </a>
          </div>
          <div className="mt-0.5 text-xs text-slate-400 dark:text-slate-500">
            {data.title}
          </div>
        </div>
      </figcaption>
    </figure>
  );
}
