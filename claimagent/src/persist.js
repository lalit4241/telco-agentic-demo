// Optional persistence hook. Node tests leave it unset. The browser demo points it at localStorage.
let hook = null;
export function onChange(fn) { hook = fn; }
export function notify() { if (hook) hook(); }
