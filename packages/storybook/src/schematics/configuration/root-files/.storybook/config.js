import { configure, addDecorator } from '@storybook/angular';
import { withKnobs } from '@storybook/addon-knobs';

function loadStories() {
  const req = require.context('..', true, /\.stories\.ts$/);
  req.keys().forEach(filename => req(filename));
}

addDecorator(withKnobs);

configure(loadStories, module);

export { configure };
