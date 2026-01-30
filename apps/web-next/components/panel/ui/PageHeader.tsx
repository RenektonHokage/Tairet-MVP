import * as React from "react";

import { cn, panelUi } from "./panel-ui";

export interface PageHeaderProps {
  title: string;
  subtitle?: string;
  breadcrumbs?: { label: string; href?: string }[];
  actions?: React.ReactNode;
}

export function PageHeader({ title, subtitle, breadcrumbs, actions }: PageHeaderProps) {
  return (
    <div className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
      <div className="flex flex-col gap-2">
        {breadcrumbs && breadcrumbs.length > 0 ? (
          <nav aria-label="Breadcrumb">
            <ol className="flex flex-wrap items-center gap-2 text-xs">
              {breadcrumbs.map((item, index) => {
                const content = item.href ? (
                  <a className={cn(panelUi.breadcrumb, panelUi.focusRing)} href={item.href}>
                    {item.label}
                  </a>
                ) : (
                  <span className="text-neutral-500">{item.label}</span>
                );

                return (
                  <li key={`${item.label}-${index}`} className="flex items-center gap-2">
                    {content}
                    {index < breadcrumbs.length - 1 ? (
                      <span className="text-neutral-400">/</span>
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </nav>
        ) : null}
        <div className="flex flex-col gap-1">
          <h1 className={panelUi.pageTitle}>{title}</h1>
          {subtitle ? <p className={panelUi.pageSubtitle}>{subtitle}</p> : null}
        </div>
      </div>
      {actions ? <div className="flex flex-wrap gap-2">{actions}</div> : null}
    </div>
  );
}
