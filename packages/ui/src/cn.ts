import { twMerge } from "tailwind-merge";

export function cn(...inputs: (string | undefined | null | boolean)[]) {
  return twMerge(
    inputs
      .filter((input): input is string => typeof input === "string")
      .join(" ")
  );
}

