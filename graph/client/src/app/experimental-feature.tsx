import { useEnvironmentConfig } from './hooks/use-environment-config';
import { Children, cloneElement } from 'react';

function ExperimentalFeature(props) {
  const environment = useEnvironmentConfig();
  const showExperimentalFeatures =
    environment.appConfig.showExperimentalFeatures;
  return showExperimentalFeatures
    ? Children.map(props.children, (child) =>
        cloneElement(child, { 'data-cy': 'experimental-feature' })
      )
    : null;
}

export default ExperimentalFeature;
