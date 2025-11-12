import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from './with-react.js';

const plugin = composePlugins(withNx(), withReact());

module.exports = plugin;
