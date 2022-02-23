import { InformationCircleIcon } from '@heroicons/react/solid';

export default function InfoPanel() {
  return (
    <div className="my-5 rounded-md bg-gray-100 p-4">
      <div className="flex">
        <div className="flex-shrink-0">
          <InformationCircleIcon
            className="mt-1 h-5 w-5 text-gray-400"
            aria-hidden="true"
          />
        </div>
        <div className="ml-3 flex-1 md:flex md:justify-between">
          <p className="my-0">
            Options can be configured in <code>project.json</code> when defining
            the executor, or when invoking it. Read more about how to configure
            targets and executors here:{' '}
            <a href="https://nx.dev/configuration/projectjson#targets.">
              https://nx.dev/configuration/projectjson#targets.
            </a>
          </p>
        </div>
      </div>
    </div>
  );
}
