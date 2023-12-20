import { composePlugins, withNx } from '@nx/webpack';
import { withReact } from './with-react';

const plugin = composePlugins(withNx(), withReact());

module.exports = plugin;
