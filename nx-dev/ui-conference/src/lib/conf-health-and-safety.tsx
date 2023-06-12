export function ConfHealthAndSafety(): JSX.Element {
  return (
    <div className="border-t border-b border-slate-200 dark:border-slate-700">
      <div className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
        <article className="grid grid-cols-1 md:grid-cols-2 md:divide-x md:divide-slate-200 md:dark:divide-slate-700">
          <div className="px-5 py-12 md:pr-12">
            <p className="mb-4">
              Nx Conf is also dedicated to providing a harassment-free
              conference experience for everyone, regardless of gender, gender
              identity and expression, age, sexual orientation, disability,
              physical appearance, body size, race, ethnicity, religion (or lack
              thereof), or technology choices.
            </p>
            <p className="mb-4">
              We do not tolerate harassment of conference participants in any
              form. Sexual language and imagery are not appropriate for any
              conference venue, including talks, workshops, parties, Twitter,
              and other online media.
            </p>
            <p className="mb-4">
              Conference participants violating these rules may be sanctioned or
              expelled from the conference without a refund at the discretion of
              the conference organizers.
            </p>
          </div>

          <div className="divide-y divide-slate-200 py-12 dark:divide-slate-700">
            <div className="px-5 py-12 md:pl-12">
              <a
                className="font-input-mono group flex w-full items-center text-blue-500 dark:text-sky-500 sm:text-xl"
                href="https://docs.google.com/document/d/1biFWD08Wrd99gRZNv4Q1tawEYGZEI3bd3J55E5uG2ZU/edit?usp=sharing"
              >
                <span className="group-hover:underline">
                  review full Code of Conduct here
                </span>
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  className="ml-1 h-8 w-8 transform-gpu transition duration-200 ease-out group-hover:translate-x-2 "
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M13 7l5 5m0 0l-5 5m5-5H6"
                  />
                </svg>
              </a>
            </div>
          </div>
        </article>
      </div>
    </div>
  );
}
