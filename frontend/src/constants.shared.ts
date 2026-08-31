// Plain (non-JSX) constants shared between the client and the server.
// Kept separate from constants.tsx so the Express server (server.ts /
// serverSchemas.ts) doesn't need to pull in React just to validate a
// category id.

export const CATEGORY_IDS = ["skate", "bmx", "parkour", "other"] as const;
export type CategoryId = (typeof CATEGORY_IDS)[number];
