// Shared mutable state accessed across feature modules. Kept as properties on a single
// exported object (rather than individually exported `let` bindings) so every module can
// both read and write it — ES module bindings for `let`/`var` exports are read-only from
// importing modules, but mutating a property of an imported object works everywhere.

export const state = {
  currentUser: null,
  users: {},
  MEMBERS: {},
};

export function getTeamMembers() {
  return Object.keys(state.MEMBERS);
}
