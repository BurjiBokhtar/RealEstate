"use client";

import { useCallback, useRef } from "react";

// One press, one action -- however fast the fingers are.
//
// `submitting` state does not stop a double click: setState is asynchronous, so
// two clicks inside the same frame both see "not submitting" and both send the
// request -- which is how a contract, a payment or an entry got saved twice.
// A ref changes the instant it is assigned. `once(fn)` returns a handler that
// ignores every call made while the previous one is still running, and lets the
// next through when it settles (success or failure). The handler itself runs
// synchronously, so a form's e.preventDefault() still happens in time.
export function useSingleFlight() {
  const busy = useRef(false);
  return useCallback(
    <A extends unknown[]>(fn: (...args: A) => unknown) =>
      (...args: A): void => {
        if (busy.current) return;
        busy.current = true;
        let result: unknown;
        try {
          result = fn(...args);
        } catch (err) {
          busy.current = false;
          console.error("action failed:", err);
          return;
        }
        Promise.resolve(result)
          .catch((err) => console.error("action failed:", err))
          .finally(() => {
            busy.current = false;
          });
      },
    []
  );
}
