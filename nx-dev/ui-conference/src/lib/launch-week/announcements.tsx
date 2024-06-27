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
          <article className="relative mx-auto max-w-screen-lg overflow-hidden pt-4 xl:max-w-screen-xl">
            <div className="grid px-5 py-12 sm:gap-8 md:grid-cols-2 lg:py-16">
              <div>
                <header>
                  <SectionHeading as="h2" variant="title" id="monday">
                    Monday
                  </SectionHeading>
                  <SectionHeading as="p" variant="display" className="mt-4">
                    Announcing Project Crystal
                  </SectionHeading>
                </header>
                <div className="mt-8 flex gap-16 font-normal">
                  <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
                    When working on the next iteration of Nx, one idea
                    consistently emerged: Nx Plugins are powerful and have
                    proven to help large enterprises adopt monorepos,
                    successfully maintaining and scaling them. However, there's
                    definitely a barrier to entry. So, what if Nx Plugins
                    functioned more like VSCode extensions? You simply add them,
                    and they instantly enhance the experience of working with a
                    given tool or technology.
                    <br />
                    This is what Nx Project Crystal is all about.
                  </p>
                </div>
                <div className="action flex flex-col space-y-2 pt-4 sm:flex-row sm:space-x-2 sm:space-y-0">
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://blog.nrwl.io/what-if-nx-plugins-were-more-like-vscode-extensions-dcdad140ae09?source=friends_link&sk=ade76fe8d50d44aafb4d4d89ab882e24"
                    title="Unveiling Project Crystal"
                  >
                    Read the blog post
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://youtu.be/wADNsVItnsM"
                    title="Nx - Project Crystal - Youtube Video"
                  >
                    Watch the video
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://www.producthunt.com/posts/nx-crystal"
                    title="Nx Project Crystal on ProductHunt"
                  >
                    Vote on ProductHunt
                  </ButtonLink>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="relative order-first flex flex-col items-center pb-8 md:order-last"
              >
                <img
                  className="rounded-lg"
                  src="/images/launch-nx/proj-crystal-launch.jpg"
                  alt="Nx Project Crystal"
                />
              </div>
            </div>
          </article>
        </div>

        {/* TUESDAY */}
        <div>
          <article className="relative mx-auto max-w-screen-lg overflow-hidden pt-4 xl:max-w-screen-xl">
            <div className="grid px-5 py-12 sm:gap-8 md:grid-cols-2 lg:py-16">
              <div>
                <header>
                  <SectionHeading as="h2" variant="title" id="tuesday">
                    Tuesday
                  </SectionHeading>
                  <SectionHeading as="p" variant="display" className="mt-4">
                    NEW PLUGIN: <a href="nx-api/nuxt">@nx/nuxt</a>
                  </SectionHeading>
                </header>
                <div className="mt-8 flex gap-16 font-normal">
                  <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
                    Checkout the newest Nx Plugin: @nx/nuxt. We're excited to
                    collaborate closer with the Vue community, and have been
                    looking forward to launching this plugin since we first
                    announced Vue support last year!
                    <br />
                    <br />
                    This is the first plugin to be created with Project Crystal
                    from day 1! Using this plugin - you can expect enhanced
                    support for the Nuxt framework in Nx. It's a game changer
                    for Nuxt developers who want to take advantage of Nx's
                    powerful monorepo capabilities.
                  </p>
                </div>
                <div className="action flex flex-col space-y-2 pt-4 sm:flex-row sm:space-x-2 sm:space-y-0">
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://blog.nrwl.io/introducing-nx-nuxt-enhanced-nuxt-js-support-in-nx-01eac78034fc?source=friends_link&sk=91582cdbd0719dc23375338ad92afa9b"
                    title="Introducing @nx/nuxt: Enhanced Nuxt.js Support in Nx"
                  >
                    Read the blog post
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://www.youtube.com/watch?v=1L-bDvEemoc&ab_channel=Nx-SmartMonorepos-FastCI"
                    title="NEW Nx Plugin: @nx/nuxt - Youtube Video"
                  >
                    Watch the video
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://www.youtube.com/watch?v=uHwUxFYX2DY&ab_channel=Nx-SmartMonorepos-FastCI"
                    title="Nx Live: @nx/nuxt w/ Nuxt Maintainer: Daniel Roe - Youtube Livestream"
                  >
                    Catch the Livestream
                  </ButtonLink>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="relative order-first flex flex-col items-center pb-8 md:order-last"
              >
                <img
                  className="rounded-lg"
                  src="/images/launch-nx/new-plugin-nx-nuxt.jpg"
                  alt="Nx Project Crystal"
                />
              </div>
            </div>
          </article>
        </div>

        {/* WEDNESDAY */}
        <div>
          <article className="relative mx-auto max-w-screen-lg overflow-hidden pt-4 xl:max-w-screen-xl">
            <div className="grid px-5 py-12 sm:gap-8 md:grid-cols-2 lg:py-16">
              <div>
                <header>
                  <SectionHeading as="h2" variant="title" id="wednesday">
                    Wednesday
                  </SectionHeading>
                  <SectionHeading as="p" variant="display" className="mt-4">
                    Nx Agents
                  </SectionHeading>
                </header>
                <div className="mt-8 flex gap-16 font-normal">
                  <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
                    Continuous Integration is broken, so we built Nx Agents to
                    fix it. Nx Agents is a new way to run your CI/CD pipelines.
                    It's a distributed and scalable solution built to handle
                    everything from the largest enterprise monorepo, down to
                    your weekend hackathon project. It's a game changer for all
                    developers that want to focus on shipping features, not
                    maintaining CI/CD infrastructure.
                  </p>
                </div>
                <div className="action flex flex-col space-y-2 pt-4 sm:flex-row sm:space-x-2 sm:space-y-0">
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://blog.nrwl.io/fast-effortless-ci-67812514ffb4?source=friends_link&sk=89e1b5c0388dda077e64a2eab5495d95"
                    title="Fast, Effortless CI"
                  >
                    Read the blog post
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://youtu.be/_FSHQIwITic"
                    title="Continuous Integration is BROKEN. So We Fixed It! - Youtube Video"
                  >
                    Watch the video
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://www.producthunt.com/posts/nx-agents"
                    title="Nx Agents on ProductHunt"
                  >
                    Vote on ProductHunt
                  </ButtonLink>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="relative order-first flex flex-col items-center pb-8 md:order-last"
              >
                <img
                  className="rounded-lg"
                  src="/images/launch-nx/nx-agents.jpg"
                  alt="Nx Agents"
                />
              </div>
            </div>
          </article>
        </div>

        {/* Thursday */}
        <div>
          <article className="relative mx-auto max-w-screen-lg overflow-hidden pt-4 xl:max-w-screen-xl">
            <div className="grid px-5 py-12 sm:gap-8 md:grid-cols-2 lg:py-16">
              <div>
                <header>
                  <SectionHeading as="h2" variant="title" id="thursday">
                    Thursday
                  </SectionHeading>
                  <SectionHeading as="p" variant="display" className="mt-4">
                    Tusky
                  </SectionHeading>
                </header>
                <div className="mt-8 flex gap-16 font-normal">
                  <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
                    Announcing Tusky: A powerful Artificial Intelligence
                    equipped with context of your workspace, commit history, and
                    historical build timing data. Tusky can uniquely understand
                    and optimize your codebase and pipelines.
                  </p>
                </div>
                <div className="action flex flex-col space-y-2 pt-4 sm:flex-row sm:space-x-2 sm:space-y-0">
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://youtu.be/Xfvv09wSoM8"
                    title="Tusky - Youtube Video"
                  >
                    Watch the video
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://nx.app"
                    title="Nx Cloud"
                  >
                    See on Nx Cloud
                  </ButtonLink>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="relative order-first flex flex-col items-center pb-8 md:order-last"
              >
                <img
                  className="rounded-lg"
                  src="/images/launch-nx/tusky.jpg"
                  alt="Tusky"
                />
              </div>
            </div>
          </article>
        </div>

        {/* Friday */}
        <div>
          <article className="relative mx-auto max-w-screen-lg overflow-hidden pt-4 xl:max-w-screen-xl">
            <div className="grid px-5 py-12 sm:gap-8 md:grid-cols-2 lg:py-16">
              <div>
                <header>
                  <SectionHeading as="h2" variant="title" id="thursday">
                    Friday
                  </SectionHeading>
                  <SectionHeading as="p" variant="display" className="mt-4">
                    Nx Release & Launch Week Recap Stream
                  </SectionHeading>
                </header>
                <div className="mt-8 flex gap-16 font-normal">
                  <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
                    Last day of launch week! Releasing packages in a monorepo
                    can be tricky and many of today's tools are either outdated
                    or need further tweaking when used in a monorepo. We decided
                    to chime in and leverage our experience of maintaining Lerna
                    and having hand-coded many release scripts in the past to
                    solve this once and for all. <br /> <br />
                    Check out the blog post and video below and make sure to
                    chime in for our live-stream!
                  </p>
                </div>
                <div className="action flex flex-col space-y-2 pt-4 sm:flex-row sm:space-x-2 sm:space-y-0">
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://blog.nrwl.io/versioning-and-releasing-packages-in-a-monorepo-45ee194378d1?source=friends_link&sk=934e4c5321774c8a9f88433e0dea578b"
                    title="Blog post - Versioning and Releasing Packages in a Monorepo"
                  >
                    Read the blog post
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://www.youtube.com/watch?v=KjZKFGu3_9I"
                    title="Releasing Nx Release"
                  >
                    Watch the talk
                  </ButtonLink>
                  <ButtonLink
                    variant="primary"
                    size="default"
                    href="https://www.youtube.com/live/xjLrFvEcxZw?si=L8Cfk41yKvYb1rud"
                    title="Nx Live Stream - Launch Week Wrap Up and Q&A"
                  >
                    Live Stream
                  </ButtonLink>
                </div>
              </div>
              <div
                aria-hidden="true"
                className="relative order-first flex flex-col items-center pb-8 md:order-last"
              >
                <img
                  className="rounded-lg"
                  src="/images/launch-nx/nx-release.jpg"
                  alt="Tusky"
                />
              </div>
            </div>
          </article>
        </div>
      </section>
    </div>
  );
}
