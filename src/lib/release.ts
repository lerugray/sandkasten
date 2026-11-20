/**
 * Release-build flag, inlined at build time (see next.config.ts). The static export build
 * (scripts/build-static.mjs) sets NEXT_PUBLIC_SAND_RELEASE=1; `next dev` leaves it unset.
 *
 * The release build ships no server: the API routes and the local-LLM InfoWar feature are
 * dev-only, and any code that would call them checks this flag first so the release makes
 * zero /api/* requests.
 */
export const IS_RELEASE = process.env.NEXT_PUBLIC_SAND_RELEASE === "1";
