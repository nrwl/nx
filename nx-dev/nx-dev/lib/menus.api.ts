import { MenusApi } from '@nx/nx-dev/data-access-menu';
import menus from '../public/documentation/generated/manifests/menus.json';

export const menusApi = new MenusApi(menus);
