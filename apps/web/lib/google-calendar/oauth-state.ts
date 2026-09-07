// Shared by authorize/route.ts (sets it) and callback/route.ts (reads +
// clears it) — pulled out of authorize/route.ts itself because Next.js's
// production build rejects any export from a route.ts file that isn't an
// HTTP method handler or one of its own reserved route-config names
// (dynamic/revalidate/runtime/etc).
export const STATE_COOKIE = 'zappigo_gcal_oauth_state';
