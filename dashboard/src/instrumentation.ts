// Polyfill broken localStorage in Node.js v22+ dev environments.
// Node.js 22+ exposes localStorage as a global (via --localstorage-file) but
// Next.js 15 passes an empty file path, making localStorage.getItem undefined.
// This runs before any SSR and patches it to a safe no-op implementation.
export async function register() {
  if (
    typeof globalThis.localStorage !== "undefined" &&
    typeof globalThis.localStorage.getItem !== "function"
  ) {
    Object.defineProperty(globalThis, "localStorage", {
      value: {
        getItem: () => null,
        setItem: () => {},
        removeItem: () => {},
        clear: () => {},
        key: () => null,
        length: 0,
      },
      writable: true,
      configurable: true,
    });
  }
}
