import { useEnvironmentConfig } from './hooks/use-environment-config';

function ExperimentalFeature(props) {
  const environment = useEnvironmentConfig();
  const showExperimentalFeatures =
    environment.appConfig.showExperimentalFeatures;

  return showExperimentalFeatures ? props.children : null;
}

export default ExperimentalFeature;
