import {
  FlipCard,
  FlipCardBack,
  FlipCardBackYoutube,
  Footer,
  Header,
  Modal,
  ModalHeader,
  SectionHeading,
  YouTube,
} from '@nx/nx-dev/ui-common';
import { NextSeo } from 'next-seo';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { ReactNode, useEffect, useState } from 'react';

interface NewYearTip {
  day: number;
  cardBack: ReactNode;
  modalHeader: ReactNode;
  modalContent: ReactNode;
}

const tips: NewYearTip[] = [
  {
    day: 1,
    cardBack: (
      <FlipCardBackYoutube
        src="https://www.youtube.com/watch?v=-_4WMl-Fn0w"
        title="Soo...what is Nx?"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 1st, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="mt-4">
          What is Nx?
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://www.youtube.com/watch?v=-_4WMl-Fn0w"
            title="Soo...what is Nx?"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          Are you just getting started with Nx? Or do you need a succinct way of
          explaining Nx to your colleagues?
        </p>
        <p className="my-4">
          Read more in our{' '}
          <Link
            href="/getting-started/intro"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Intro to Nx
          </Link>
        </p>
      </>
    ),
  },
  {
    day: 2,
    cardBack: (
      <FlipCardBackYoutube
        src="https://www.youtube.com/watch?v=ArmERpNvC8Y"
        title="Package based vs Integrated Style - Use Nx however it works best for you"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 2nd, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="mt-4">
          Which Style of Workspace is Right for You?
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://www.youtube.com/watch?v=ArmERpNvC8Y"
            title="Package based vs Integrated Style - Use Nx however it works best for you"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          Nx can provide benefits no matter how your repository is organized. It
          helps to have terms to describe different kinds of repositories.
        </p>
        <p className="my-4">
          Read more in our{' '}
          <Link
            href="/concepts/integrated-vs-package-based"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Types of Repos Guide
          </Link>
        </p>
      </>
    ),
  },
  {
    day: 3,
    cardBack: (
      <FlipCardBackYoutube
        src="https://www.youtube.com/watch?v=NZF0ZJpgaJM"
        title="What is Nx Cloud?"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 3rd, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="mt-4">
          What is Nx Cloud?
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://www.youtube.com/watch?v=NZF0ZJpgaJM"
            title="What is Nx Cloud?"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          Nx does not just enable you to manage your repo even as it scales to a
          large monorepo - it also makes your CI fast. With features like remote
          caching, distributed task execution,{' '}
          <Link
            href="/ci/features/nx-agents"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Nx Agents
          </Link>
          , and auto-splitting E2E tests, your CI times can be dramatically
          reduced without a large maintenance burden on you.
        </p>
        <p className="my-4">
          Read more about how to set up{' '}
          <Link
            href="/ci/intro/ci-with-nx"
            className="underline text-slate-900 dark:text-slate-100"
          >
            CI with Nx
          </Link>
        </p>
      </>
    ),
  },
  {
    day: 4,
    cardBack: (
      <FlipCardBackYoutube
        src="https://youtu.be/VmGCZ77ao_I"
        title="Add Nx to Any Project"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 4th, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="my-4">
          Add Nx to an Existing Project
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://youtu.be/VmGCZ77ao_I"
            title="Add Nx to Any Project"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          Nx can be incrementally adopted in any project. A single{' '}
          <code>npx nx init</code> command will get you started.
        </p>
        <p className="my-4">
          Read more about how to{' '}
          <Link
            href="/recipes/adopting-nx/adding-to-existing-project"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Add Nx to an Existing Project
          </Link>
        </p>
      </>
    ),
  },
  {
    day: 5,
    cardBack: (
      <FlipCardBackYoutube
        src="https://www.youtube.com/watch?v=dotA6ZSmNL4"
        title="Superpowered Micro Frontends with Monorepos"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 5th, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="my-4">
          Micro Frontends with Nx
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://www.youtube.com/watch?v=dotA6ZSmNL4"
            title="Superpowered Micro Frontends with Monorepos"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          Micro Frontends allow you to deploy different sections of a web
          application independently. Nx helps you to set them up in a structured
          way.
        </p>
        <p className="my-4">
          Read more about how to set up{' '}
          <Link
            href="/concepts/module-federation/micro-frontend-architecture"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Micro Frontends with Nx
          </Link>
        </p>
      </>
    ),
  },
  {
    day: 8,
    cardBack: (
      <FlipCardBack>
        <h3 className="text-center">Explore Example Repos</h3>
      </FlipCardBack>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 8th, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="my-4">
          Explore Example Repos
        </SectionHeading>
        <p className="my-4">
          Nx can work with any technology stack and we have created examples for
          many of them.
        </p>
        <p className="my-4">
          Read more about using{' '}
          <Link
            href="/showcase/example-repos"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Nx with your Favorite Tech
          </Link>
        </p>
      </>
    ),
  },
  {
    day: 9,
    cardBack: (
      <FlipCardBackYoutube
        src="https://youtu.be/ocllb5KEXZk"
        title="Build Your Own CLI"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 9th, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="my-4">
          Let's Build a CLI
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://youtu.be/ocllb5KEXZk"
            title="Build Your Own CLI"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          If you maintain a framework, open source library, or starter repo, you
          can use Nx to allow your users to quickly create a new repo and keep
          their existing repo up to date with the changes that you make.
        </p>
        <p className="my-4">
          Read more about how to use Nx to{' '}
          <Link
            href="/extending-nx/recipes/create-install-package"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Build Your Own CLI
          </Link>
        </p>
      </>
    ),
  },
  {
    day: 10,
    cardBack: (
      <FlipCardBackYoutube
        src="https://youtu.be/XLOUFZeqRpM"
        title="Victor FIXES Your CI with Nx"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 10th, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="my-4">
          Nx Agents: The Next Leap in Distributed Task Execution
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://youtu.be/XLOUFZeqRpM"
            title="Victor FIXES Your CI with Nx"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          With Nx Agents, you allow Nx Cloud to manage your agent machines in CI
          for you. Along with that convenience, Nx Agents also offer dynamic
          scaling, automatic task splitting and flaky task re-running.
        </p>
        <p className="my-4">
          Currently in private beta, Nx Agents are slated for public release in
          February 2024. Don't miss the opportunity to be among the first to
          experience this groundbreaking tool.{' '}
          <Link
            href="https://go.nx.dev/nx-agents-ea"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Sign up now for early access.
          </Link>
        </p>
        <p className="my-4">
          Read more about the upcoming{' '}
          <Link
            href="/ci/features/nx-agents"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Nx Agents
          </Link>
        </p>
      </>
    ),
  },
  {
    day: 11,
    cardBack: (
      <FlipCardBackYoutube
        src="https://www.youtube.com/watch?v=ztNpLf2Zl-c"
        title="Graduating Your Standalone Nx Repo To A Monorepo"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 11th, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="my-4">
          Graduating to a Monorepo
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://www.youtube.com/watch?v=ztNpLf2Zl-c"
            title="Graduating Your Standalone Nx Repo To A Monorepo"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          If you start an Nx repo with a single standalone app, you can easily
          convert it into a monorepo when you are ready to add more apps to the
          repo.
        </p>
        <p className="my-4">
          Read more about using Nx to{' '}
          <Link
            href="/recipes/tips-n-tricks/standalone-to-integrated"
            className="underline text-slate-900 dark:text-slate-100"
          >
            convert a standalone app repo to a monorepo
          </Link>
          .
        </p>
      </>
    ),
  },
  {
    day: 12,
    cardBack: (
      <FlipCardBackYoutube
        src="https://youtu.be/Ss6MfcXi0jE"
        title="Run Code Migrations to Update your Codebase"
      ></FlipCardBackYoutube>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 12th, 2024</h3>,
    modalContent: (
      <>
        <SectionHeading as="p" variant="display" className="my-4">
          Keep Your Tooling Up to Date
        </SectionHeading>
        <div className="mx-auto my-8 max-w-3xl">
          <YouTube
            src="https://youtu.be/Ss6MfcXi0jE"
            title="Run Code Migrations to Update your Codebase"
            caption=""
            width="100%"
          ></YouTube>
        </div>
        <p className="my-4">
          Nx allows you to keep your tooling versions and configuration files up
          to date - even after breaking changes. You can think of it as{' '}
          <Link
            href="https://blog.nrwl.io/evergreen-tooling-more-than-just-codemods-fc68f32ce605"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Evergreen Tooling
          </Link>
          .
        </p>
        <p className="my-4">
          Read more about using Nx to{' '}
          <Link
            href="/core-features/automate-updating-dependencies"
            className="underline text-slate-900 dark:text-slate-100"
          >
            Automate Updating Dependencies
          </Link>
        </p>
      </>
    ),
  },
];

export default function NewYear(): JSX.Element {
  const currentDay =
    new Date().getFullYear() === 2024 ? new Date().getDate() : 0;
  const router = useRouter();
  const [cards, setCards] = useState({});
  const [currentModal, setCurrentModal] = useState(0);

  useEffect(() => {
    const cards = JSON.parse(localStorage.getItem('cards') || '{}');
    if (cards) {
      setCards(cards);
    }
  }, []);
  useEffect(() => {
    localStorage.setItem('cards', JSON.stringify(cards));
  }, [cards]);
  const onFlip = (text, isFlipped) => {
    setCards({ ...cards, [text]: isFlipped });
  };
  function getIsFlippable(day: number) {
    return currentDay >= day;
  }

  return (
    <>
      <NextSeo
        title="Nx New Year Tips"
        description="Start off the new year with these tips on how to make the most of Nx."
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx New Year Tips',
          description:
            'Start off the new year with these tips on how to make the most of Nx.',
          images: [
            {
              url: 'https://nx.dev/socials/nx-media.png',
              width: 800,
              height: 421,
              alt: 'Nx: Smart, Fast and Extensible Build System',
              type: 'image/jpeg',
            },
          ],
          siteName: 'NxDev',
          type: 'website',
        }}
      />
      <Header />
      <main id="main" role="main">
        <div className="w-full pt-10 bg-slate-50 dark:bg-slate-800/40">
          <div
            id="new-year"
            className="py-18 mx-auto max-w-7xl px-4 sm:px-6 lg:px-8"
          >
            <article id="nx-new-year-challenge" className="relative">
              <SectionHeading as="h1" variant="display" className="my-4">
                Nx New Year Tips
              </SectionHeading>
              <p>
                Each day, during the first two weeks of January, a new card will
                be unlocked for you to flip.
              </p>

              <div className="mx-auto items-stretch py-12 grid grid-cols-2 gap-8 sm:grid-cols-3 md:grid-cols-5 lg:py-16">
                {tips.map((tip) => (
                  <FlipCard
                    key={tip.day}
                    isFlippable={getIsFlippable(tip.day)}
                    onFlip={onFlip}
                    isFlipped={cards[tip.day]}
                    day={tip.day}
                    onClick={() =>
                      getIsFlippable(tip.day) && setCurrentModal(tip.day)
                    }
                  >
                    {tip.cardBack}
                  </FlipCard>
                ))}
              </div>
            </article>
          </div>

          {tips.map((tip) => (
            <Modal
              key={tip.day}
              isOpen={currentModal === tip.day}
              onClose={() => setCurrentModal(0)}
            >
              <ModalHeader onClose={() => setCurrentModal(0)}>
                {tip.modalHeader}
              </ModalHeader>
              <div className="p-6">{tip.modalContent}</div>
            </Modal>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
