declare module 'workbox-routing/NavigationRoute.js' {
  export class NavigationRoute {
    constructor(
      handler: (...args: any[]) => Response | Promise<Response>,
      options?: Record<string, unknown>,
    );
  }
}

declare module 'workbox-routing/registerRoute.js' {
  import { NavigationRoute } from 'workbox-routing/NavigationRoute.js';

  export function registerRoute(route: NavigationRoute): void;
}
