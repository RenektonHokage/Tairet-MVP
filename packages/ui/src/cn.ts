// packages/ui/src/cn.ts

export type ClassDictionary = Record<string, boolean | null | undefined>;

export type ClassValue = string | number | null | undefined | boolean | ClassDictionary | ClassValue[];

export function cn(...inputs: ClassValue[]): string {
  const classes: string[] = [];

  const push = (value: ClassValue): void => {
    if (!value) return;

    if (typeof value === "string" || typeof value === "number") {
      classes.push(String(value));
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(push);
      return;
    }

    if (typeof value === "object") {
      for (const [key, enabled] of Object.entries(value)) {
        if (enabled) {
          classes.push(key);
        }
      }
      return;
    }

    // boolean true/false ya quedan cubiertos por el if (!value) de arriba
  };

  inputs.forEach(push);

  return classes.join(" ");
}

