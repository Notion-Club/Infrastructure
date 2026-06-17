// Build-time stub for node-only packages (web-push) and `server-only`.
// These are reached only through server-action modules that client
// components import for their handlers; at static render they never execute.
// Stubbed so the browser bundle doesn't pull node builtins / throw at eval.
const stub: any = {};
export default stub;
