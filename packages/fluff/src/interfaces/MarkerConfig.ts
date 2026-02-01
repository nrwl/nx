import type { BreakMarkerConfig } from './BreakMarkerConfig.js';
import type { ForMarkerConfig } from './ForMarkerConfig.js';
import type { IfMarkerConfig } from './IfMarkerConfig.js';
import type { SwitchMarkerConfig } from './SwitchMarkerConfig.js';
import type { TextMarkerConfig } from './TextMarkerConfig.js';

export type MarkerConfig = IfMarkerConfig | ForMarkerConfig | SwitchMarkerConfig | TextMarkerConfig | BreakMarkerConfig;
