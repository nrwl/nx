import { BoltIcon, UserGroupIcon } from '@heroicons/react/24/outline';
import {
  NxAgentsIcon,
  NxReplayIcon,
  SectionHeading,
} from '@nx/nx-dev/ui-common';

const features = [
  {
    name: 'Cache with Nx Replay',
    description:
      'Quis tellus eget adipiscing convallis sit sit eget aliquet quis. Suspendisse eget egestas a elementum pulvinar et feugiat blandit at. In mi viverra elit nunc.',
    icon: NxReplayIcon,
  },
  {
    name: 'Distribution with Nx Agents',
    description:
      'Quis tellus eget adipiscing convallis sit sit eget aliquet quis. Suspendisse eget egestas a elementum pulvinar et feugiat blandit at. In mi viverra elit nunc.',
    icon: NxAgentsIcon,
  },
  {
    name: 'Split tasks with Atomizer',
    description:
      'Quis tellus eget adipiscing convallis sit sit eget aliquet quis. Suspendisse eget egestas a elementum pulvinar et feugiat blandit at. In mi viverra elit nunc.',
    icon: BoltIcon,
  },
];

export function ScaleCiAndTeams(): JSX.Element {
  return (
    <div className="mx-auto max-w-7xl px-6 lg:px-8">
      <div className="max-w-3xl">
        <SectionHeading as="h2" variant="display" id="scale-ci-and-teams">
          Scale CI & teams
        </SectionHeading>
        <p className="mt-6 text-lg leading-8">
          Quis tellus eget adipiscing convallis sit sit eget aliquet quis.
          Suspendisse eget egestas a elementum pulvinar et feugiat blandit at.
          In mi viverra elit nunc.
        </p>
      </div>
      <div className="mx-auto mt-16 max-w-2xl lg:max-w-none">
        <dl className="grid max-w-xl grid-cols-1 gap-x-8 gap-y-16 lg:max-w-none lg:grid-cols-3">
          {features.map((feature) => (
            <div key={feature.name} className="flex flex-col">
              <dt className="flex items-center gap-x-3 text-base font-semibold leading-7">
                <feature.icon
                  className="h-5 w-5 flex-none"
                  aria-hidden="true"
                />
                {feature.name}
              </dt>
              <dd className="mt-4 flex flex-auto flex-col text-base leading-7 text-slate-500">
                <p className="flex-auto">{feature.description}</p>
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}
