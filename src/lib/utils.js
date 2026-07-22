import { clsx } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs) {
  return twMerge(clsx(inputs))
} 


export const isIframe = window.self !== window.top;

// Fades the right edge of a horizontally-scrolling row (filter/sort chips) instead of
// hard-clipping whichever chip happens to land on the viewport boundary.
export const SCROLL_FADE_STYLE = {
  WebkitMaskImage: "linear-gradient(to right, black calc(100% - 28px), transparent 100%)",
  maskImage: "linear-gradient(to right, black calc(100% - 28px), transparent 100%)",
};
