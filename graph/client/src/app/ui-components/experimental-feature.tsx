import { useEnvironmentConfig } from '@nx/graph/shared';
import { Children, cloneElement } from 'react';

export function ExperimentalFeature(props) {
  const environment = useEnvironmentConfig();
  const showExperimentalFeatures =
    environment.appConfig.showExperimentalFeatures;
  return showExperimentalFeatures
    ? Children.map(props.children, (child) =>
        cloneElement(child, { 'data-cy': 'experimental-feature' })
      )
    : null;
}
