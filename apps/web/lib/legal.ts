// Bump this (a plain date string is enough) whenever /terms or /privacy
// change in any way that matters legally — existing users' User.termsVersion
// (see packages/db/prisma/schema/user.prisma) then reads as stale, which is
// what a future "re-accept the updated terms" prompt would key off of. Not
// wired up to any such prompt yet — this is just where that comparison
// would read from when it exists.
export const TERMS_VERSION = '2026-07-22';
