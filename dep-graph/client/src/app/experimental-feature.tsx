import { useEnvironmentConfig } from './hooks/use-environment-config';

function ExperimentalFeature(props) {
  const environment = useEnvironmentConfig();
  const showExperimentalFeatures =
    environment.appConfig.showExperimentalFeatures;

  return showExperimentalFeatures ? (
    <div data-cy="experimental-features" className="bg-purple-200 pb-2">
      <h3 className="mt-4 cursor-text px-4 py-2 text-sm font-semibold uppercase tracking-wide text-gray-900 lg:text-xs ">
        Experimental Features
      </h3>
      {props.children}
    </div>
  ) : null;
}

export default ExperimentalFeature;
