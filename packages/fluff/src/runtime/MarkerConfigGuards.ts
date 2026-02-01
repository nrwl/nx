import type { BreakMarkerConfig } from '../interfaces/BreakMarkerConfig.js';
import type { FluffHostElement } from '../interfaces/FluffHostElement.js';
import type { ForMarkerConfig } from '../interfaces/ForMarkerConfig.js';
import type { IfMarkerConfig } from '../interfaces/IfMarkerConfig.js';
import type { MarkerConfig } from '../interfaces/MarkerConfig.js';
import type { SwitchMarkerConfig } from '../interfaces/SwitchMarkerConfig.js';
import type { TextMarkerConfig } from '../interfaces/TextMarkerConfig.js';

export class MarkerConfigGuards
{
    public static isFluffHostElement(el: Element): el is FluffHostElement
    {
        return '__getReactiveProp' in el;
    }

    public static isIfConfig(config: MarkerConfig): config is IfMarkerConfig
    {
        return config.type === 'if';
    }

    public static isForConfig(config: MarkerConfig): config is ForMarkerConfig
    {
        return config.type === 'for';
    }

    public static isSwitchConfig(config: MarkerConfig): config is SwitchMarkerConfig
    {
        return config.type === 'switch';
    }

    public static isTextConfig(config: MarkerConfig): config is TextMarkerConfig
    {
        return config.type === 'text';
    }

    public static isBreakConfig(config: MarkerConfig): config is BreakMarkerConfig
    {
        return config.type === 'break';
    }
}
