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
        <p>Here is some text about what Nx is</p>
        <p>
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
        <p>Here is some text about ways to use Nx</p>
        <p>
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
    modalContent: <div></div>,
  },
  {
    day: 4,
    cardBack: (
      <FlipCardBack>
        <h3 className="text-center">Add Nx to an Existing Project</h3>
      </FlipCardBack>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 4th, 2024</h3>,
    modalContent: <div></div>,
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
    modalContent: <div></div>,
  },
  {
    day: 8,
    cardBack: (
      <FlipCardBack>
        <h3 className="text-center">Explore Example Repos</h3>
      </FlipCardBack>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 8th, 2024</h3>,
    modalContent: <div></div>,
  },
  {
    day: 9,
    cardBack: (
      <FlipCardBack>
        <h3 className="text-center">Let's Build a CLI</h3>
      </FlipCardBack>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 9th, 2024</h3>,
    modalContent: <div></div>,
  },
  {
    day: 10,
    cardBack: (
      <FlipCardBack>
        <h3 className="text-center">Optimizing Your CI/CD</h3>
      </FlipCardBack>
    ),
    modalHeader: <h3 className="text-xl font-semibold">January 10th, 2024</h3>,
    modalContent: <div></div>,
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
    modalContent: <div></div>,
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
    modalContent: <div></div>,
  },
];

export default function NewYear(): JSX.Element {
  const currentDay =
    new Date().getFullYear() === 2023 ? new Date().getDate() : 0;
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
        title="Nx New Year Tune-Up"
        description="There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Discord and Twitter"
        openGraph={{
          url: 'https://nx.dev' + router.asPath,
          title: 'Nx Community',
          description:
            'There are many ways you can connect with the open-source Nx community. The community is rich and dynamic offering Nx plugins and help on multiple platforms like GitHub, Discord and Twitter',
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
                Nx New Year Challenge
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
                    onClick={() => setCurrentModal(tip.day)}
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
              onClose={() => {
                setCurrentModal(0);
              }}
            >
              <ModalHeader>{tip.modalHeader}</ModalHeader>
              <div className="p-6">{tip.modalContent}</div>
            </Modal>
          ))}
        </div>
      </main>
      <Footer />
    </>
  );
}
