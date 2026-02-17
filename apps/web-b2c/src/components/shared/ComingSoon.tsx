import type { ReactNode } from "react";
import { Instagram, Youtube } from "lucide-react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import tiktokIcon from "@/assets/tiktok.svg";

type SocialLinks = {
  instagram?: string;
  tiktok?: string;
  youtube?: string;
};

interface ComingSoonProps {
  badgeText?: string;
  title: string;
  subtitle: string;
  emphasis: string;
  primaryCtaLabel: string;
  primaryCtaTo: string;
  showSocialRow?: boolean;
  socialLinks?: SocialLinks;
  className?: string;
}

const defaultSocialLinks: Required<SocialLinks> = {
  instagram: "https://www.instagram.com/tairetpy/",
  tiktok: "https://www.tiktok.com/@tairetpy",
  youtube: "https://www.youtube.com/@tairetpy",
};

function SocialItem({
  href,
  label,
  children,
}: {
  href?: string;
  label: string;
  children: ReactNode;
}) {
  const baseClassName =
    "inline-flex h-11 w-11 items-center justify-center rounded-full border border-border bg-background text-foreground/80 transition-colors";

  if (!href) {
    return (
      <span aria-label={label} className={cn(baseClassName, "cursor-not-allowed opacity-50")}>
        {children}
      </span>
    );
  }

  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={label}
      className={cn(baseClassName, "hover:bg-muted hover:text-foreground")}
    >
      {children}
    </a>
  );
}

export default function ComingSoon({
  badgeText = "Próximamente",
  title,
  subtitle,
  emphasis,
  primaryCtaLabel,
  primaryCtaTo,
  showSocialRow = true,
  socialLinks,
  className,
}: ComingSoonProps) {
  const links = { ...defaultSocialLinks, ...socialLinks };

  return (
    <section className={cn("py-8 md:py-12", className)}>
      <div className="mx-auto max-w-3xl rounded-2xl border border-border bg-card px-6 py-10 text-center shadow-sm md:px-10 md:py-12">
        <span className="inline-flex rounded-full bg-muted px-4 py-2 text-sm font-medium text-muted-foreground">
          {badgeText}
        </span>

        <h1 className="mt-6 text-4xl font-bold leading-tight text-foreground md:text-6xl">{title}</h1>
        <p className="mt-8 text-lg text-muted-foreground md:text-[1.75rem]">{subtitle}</p>
        <p className="mt-5 text-[1.9rem] font-semibold leading-tight text-foreground md:text-[2.25rem]">
          {emphasis}
        </p>

        <Button
          asChild
          className="mt-10 h-12 min-w-44 rounded-xl bg-foreground px-8 text-base font-semibold text-background hover:bg-foreground/90"
        >
          <Link to={primaryCtaTo}>{primaryCtaLabel}</Link>
        </Button>

        {showSocialRow ? (
          <div className="mt-10 border-t border-border pt-8">
            <p className="text-sm text-muted-foreground">
              Está al tanto de nuestros anuncios en nuestras redes sociales
            </p>
            <div className="mt-5 flex items-center justify-center gap-4">
              <SocialItem href={links.instagram} label="Instagram de Tairet">
                <Instagram className="h-5 w-5" />
              </SocialItem>
              <SocialItem href={links.tiktok} label="TikTok de Tairet">
                <img src={tiktokIcon} alt="" className="h-5 w-5 opacity-80" />
              </SocialItem>
              <SocialItem href={links.youtube} label="YouTube de Tairet">
                <Youtube className="h-5 w-5" />
              </SocialItem>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}
