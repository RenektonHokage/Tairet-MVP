import type { SVGProps } from "react";

type BrandIconProps = SVGProps<SVGSVGElement> & {
  title?: string;
};

function getA11yProps(title?: string) {
  if (title) {
    return { role: "img" as const, "aria-label": title };
  }

  return { "aria-hidden": true as const };
}

export function InstagramIcon({ title, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...getA11yProps(title)}
      {...props}
    >
      <rect x="3.5" y="3.5" width="17" height="17" rx="5.5" />
      <circle cx="12" cy="12" r="4.15" />
      <circle cx="17.4" cy="6.6" r="0.9" fill="currentColor" stroke="none" />
    </svg>
  );
}

export function TikTokIcon({ title, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      {...getA11yProps(title)}
      {...props}
    >
      <path d="M14.25 3a1 1 0 0 1 1 1c0 1.74 1.42 3.15 3.17 3.15a1 1 0 1 1 0 2A5.1 5.1 0 0 1 15.4 8v7.29a5.4 5.4 0 1 1-4.35-5.28 1 1 0 1 1-.38 1.96 3.4 3.4 0 1 0 2.73 3.33V4a1 1 0 0 1 1-1Z" />
    </svg>
  );
}

export function YouTubeIcon({ title, ...props }: BrandIconProps) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
      {...getA11yProps(title)}
      {...props}
    >
      <rect x="2.8" y="6.2" width="18.4" height="11.6" rx="3.6" />
      <path d="m10 9.4 5.2 2.6L10 14.6z" fill="currentColor" stroke="none" />
    </svg>
  );
}
