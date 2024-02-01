import { ButtonLink, SectionHeading } from '@nx/nx-dev/ui-common';

export function LaunchWeekAnnouncements(): JSX.Element {
  return (
    <div className="border-y border-slate-200 dark:border-slate-700">
      <section className="w-full divide-y divide-slate-200  dark:divide-slate-700">
        <article className="mx-auto max-w-screen-lg xl:max-w-screen-xl">
          <div className="px-5 py-12 md:pr-12">
            <p>
              We’ll be sharing new features and content daily during launch
              week, so be sure to keep an eye on this space for all the latest
              info!
            </p>
          </div>
        </article>

        {/* MONDAY */}
        <div>
          <article className="relative overflow-hidden pt-4 mx-auto max-w-screen-lg xl:max-w-screen-xl">
            <div className="px-5 pt-12  sm:grid sm:grid-cols-2 sm:gap-8 lg:py-16">
              <div>
                <header>
                  <SectionHeading as="h2" variant="title" id="monday">
                    Monday
                  </SectionHeading>
                  <SectionHeading as="p" variant="display" className="mt-4">
                    Monday Headline
                  </SectionHeading>
                </header>
                <div className="mt-8 flex gap-16 font-normal">
                  <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
                    Lorem ipsum dolor sit amet, consectetur adipisicing elit.
                    Asperiores explicabo fugiat maxime mollitia non officiis
                    omnis possimus repellat? Ab architecto ducimus ex
                    laboriosam, libero numquam optio porro quae quasi,
                    quibusdam, rem tenetur velit veniam. Accusamus, cum dolores
                    eveniet nihil odio placeat quaerat recusandae rerum tempora
                    totam! Amet animi deleniti ea est hic maiores modi quidem
                    reiciendis unde, veritatis? Accusantium consequuntur,
                    dolorem error explicabo facere iste molestias mollitia
                    nostrum perferendis, praesentium quos reprehenderit sunt
                    velit vitae.
                  </p>
                </div>
                <div className="action mt-6 flex">
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="UPDATE-ME"
                    title="UPDATE ME"
                  >
                    UPDATE ME
                  </ButtonLink>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="relative flex flex-col items-center"
              >
                <img
                  className="rounded-lg"
                  src="https://placehold.co/600x400"
                />
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
