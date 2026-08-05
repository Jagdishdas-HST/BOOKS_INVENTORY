import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * cn() — compose Tailwind class names with proper conflict resolution.
 *
 * Use this whenever you build className programmatically (variants, conditional
 * styles, prop overrides). Stops `bg-red-500 bg-blue-500` from leaving both in
 * the final output (twMerge picks the last one).
 *
 *   <View className={cn("p-md bg-card", error && "border-danger")} />
 */
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
