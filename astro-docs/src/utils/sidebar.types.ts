import type { StarlightUserConfig } from '@astrojs/starlight/types';

export type SidebarItem = NonNullable<StarlightUserConfig['sidebar']>[number];
export type SidebarSubItem = Extract<SidebarItem, { items: any[] }>;
