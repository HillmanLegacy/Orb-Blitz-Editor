import { useEffect, useRef } from "react";

const FOCUSABLE_SELECTOR = [
  "button:not([disabled])",
  "[href]",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])",
].join(",");

/**
 * Keeps keyboard focus inside an open dialog and returns focus to the control
 * that opened it. This is intentionally UI-only and does not listen to the
 * document pointer or gameplay input events.
 */
export function useModalAccessibility<T extends HTMLElement>(
  open: boolean,
  onClose: () => void,
  returnFocusSelector?: string,
) {
  const dialogRef = useRef<T>(null);

  useEffect(() => {
    if (!open) return;

    const previousFocus = document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null;
    const dialog = dialogRef.current;
    const focusFirst = () => {
      const firstFocusable = dialog?.querySelector<HTMLElement>(FOCUSABLE_SELECTOR);
      (firstFocusable ?? dialog)?.focus({ preventScroll: true });
    };
    const frame = window.requestAnimationFrame(focusFirst);

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog) return;

      const focusables = Array.from(dialog.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR));
      if (focusables.length === 0) {
        event.preventDefault();
        dialog.focus();
        return;
      }

      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => {
      window.cancelAnimationFrame(frame);
      document.removeEventListener("keydown", handleKeyDown);
      window.requestAnimationFrame(() => {
        if (previousFocus && previousFocus !== document.body && previousFocus.isConnected) {
          previousFocus.focus({ preventScroll: true });
          return;
        }
        const fallback = returnFocusSelector
          ? document.querySelector<HTMLElement>(returnFocusSelector)
          : null;
        fallback?.focus({ preventScroll: true });
      });
    };
  }, [open, onClose, returnFocusSelector]);

  return dialogRef;
}