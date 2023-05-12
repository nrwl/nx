import {
  AcademicCapIcon,
  BeakerIcon,
  ChartBarIcon,
  ChatBubbleBottomCenterIcon,
  ChatBubbleBottomCenterTextIcon,
  CheckBadgeIcon,
  CloudArrowDownIcon,
  CubeTransparentIcon,
  GiftIcon,
  HeartIcon,
  KeyIcon,
  LightBulbIcon,
  MicrophoneIcon,
  NewspaperIcon,
  PencilIcon,
  ServerStackIcon,
  UserGroupIcon,
  UserIcon,
  UserPlusIcon,
  UsersIcon,
  VideoCameraIcon,
} from '@heroicons/react/24/outline';
import { CogIcon } from '@heroicons/react/24/solid';
import { SectionHeading } from './typography';

export function ChampionPerks(): JSX.Element {
  return (
    <article
      id="nx-is-fast"
      className="relative bg-slate-50 py-28 dark:bg-slate-800/40"
    >
      <div className="mx-auto max-w-7xl px-4 sm:grid sm:grid-cols-2 sm:gap-8 sm:px-6 lg:px-8">
        <div>
          <header>
            <SectionHeading as="h1" variant="title" id="nx-is-fast">
              Interested in joining the Nx Champions program yourself?
            </SectionHeading>
            <SectionHeading
              as="p"
              variant="display"
              id="nx-is-fast"
              className="mt-4"
            >
              The Making of a Champion
            </SectionHeading>
          </header>
          <div className="mt-8 flex gap-16 font-normal">
            <p className="max-w-xl text-lg text-slate-700 dark:text-slate-400">
              If you love Nx and want other people to love Nx too, you may have
              the makings of an Nx Champion.
            </p>
          </div>
        </div>
      </div>
      <div className="mx-auto max-w-7xl px-4 pt-12 sm:px-6 lg:px-8 lg:pt-16">
        <dl className="grid grid-cols-1 gap-16 sm:grid-cols-2 lg:grid-cols-4">
          <div key="Recognition as a Leader" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <CheckBadgeIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <HeartIcon
                  className="absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-8 group-hover:-translate-y-1 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <GiftIcon
                  className="5 absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-5 group-hover:translate-y-6 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Recognition as a Leader
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              You'll be listed in the Nx Champion directory above, receive
              branded swag for yourself and Nx stickers to give away.
            </dd>
          </div>
          <div key="Content Promotion" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <NewspaperIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <VideoCameraIcon
                  className="absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-8 group-hover:-translate-y-1 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <MicrophoneIcon
                  className="5 absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-5 group-hover:translate-y-6 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Content Promotion
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              You can collaborate with other Nx Champions to improve your blog
              posts and videos. Nx will promote your content on our social media
              channels.
            </dd>
          </div>
          <div key="Special Access" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <KeyIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <LightBulbIcon
                  className="absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-8 group-hover:-translate-y-1 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <ChatBubbleBottomCenterTextIcon
                  className="5 absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-5 group-hover:translate-y-6 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Special Access
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              You'll have a dedicated slack channel with the Nx team and monthly
              video calls with Nx team members to share feedback and brainstorm
              content ideas.
            </dd>
          </div>
          <div key="Join the Program" className="group">
            <dt>
              <div className="relative flex h-12 w-12">
                <UserGroupIcon
                  className="h-8 w-8 text-blue-500 dark:text-sky-500"
                  aria-hidden="true"
                />
                <UsersIcon
                  className="absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-8 group-hover:-translate-y-1 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
                <UserPlusIcon
                  className="5 absolute inset-0 h-8 w-8 text-purple-500 opacity-0 transition-all group-hover:translate-x-5 group-hover:translate-y-6 group-hover:opacity-100 dark:text-fuchsia-500"
                  aria-hidden="true"
                />
              </div>
              <p className="relative mt-4 text-base font-medium leading-6 text-slate-900 dark:text-slate-100">
                <span className="absolute -left-4 h-full w-0.5 bg-blue-500 dark:bg-sky-500"></span>
                Join the Program
              </p>
            </dt>
            <dd className="mt-2 text-base text-slate-500 dark:text-slate-400">
              When you're ready to join, fill out the{' '}
              <a
                className="underline text-slate-900 dark:text-slate-100"
                href="https://forms.gle/wYd9mC3ka64ki96G7"
              >
                application form
              </a>{' '}
              and we'll schedule an informal conversation with an Nx team member
              to make sure the program is a good fit for you.
            </dd>
          </div>
        </dl>
      </div>
    </article>
  );
}
