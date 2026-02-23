import type { CalendarProps } from "@/components/ui/calendar";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type CalendarClassNames = NonNullable<CalendarProps["classNames"]>;

interface CalendarClassNamesOptions {
  hideInitialSelectedVisual?: boolean;
}

export const getCalendarClassNames = (
  options: CalendarClassNamesOptions = {}
): CalendarClassNames => {
  const { hideInitialSelectedVisual = false } = options;

  return {
    months: "flex flex-col sm:flex-row space-y-4 sm:space-x-4 sm:space-y-0",
    month: "space-y-4",
    caption: "flex justify-center pt-1 relative items-center",
    caption_label: "text-sm font-medium",
    nav: "space-x-1 flex items-center",
    nav_button: cn(
      buttonVariants({ variant: "ghost" }),
      "h-7 w-7 rounded-md bg-transparent p-0 text-foreground/65 hover:bg-foreground/10 hover:text-foreground"
    ),
    nav_button_previous: "absolute left-1",
    nav_button_next: "absolute right-1",
    table: "w-full border-collapse space-y-1",
    head_row: "flex",
    head_cell: "text-foreground/60 rounded-md w-9 font-normal text-[0.8rem]",
    row: "flex w-full mt-2",
    cell: "h-9 w-9 text-center text-sm p-0 relative focus-within:relative focus-within:z-20",
    day: cn(
      buttonVariants({ variant: "ghost" }),
      "h-9 w-9 p-0 font-normal aria-selected:opacity-100"
    ),
    day_range_end: "day-range-end",
    day_selected: hideInitialSelectedVisual
      ? "border border-transparent bg-transparent text-foreground hover:bg-foreground/8 hover:text-foreground focus:bg-foreground/8 focus:text-foreground"
      : "relative border border-foreground/20 bg-foreground/10 text-foreground hover:bg-foreground/12 hover:text-foreground focus:bg-foreground/12 focus:text-foreground after:pointer-events-none after:absolute after:bottom-1 after:left-1/2 after:h-1 after:w-1 after:-translate-x-1/2 after:rounded-full after:bg-current after:opacity-60",
    day_today:
      "border border-foreground/20 bg-transparent text-foreground/75 font-medium ring-0 hover:bg-transparent focus:bg-transparent focus-visible:ring-0",
    day_outside:
      "day-outside text-foreground/35 opacity-50 aria-selected:bg-foreground/10 aria-selected:text-foreground/35 aria-selected:opacity-30",
    day_disabled: "cursor-not-allowed text-foreground/30 opacity-50",
    day_range_middle:
      "aria-selected:bg-accent aria-selected:text-accent-foreground",
    day_hidden: "invisible",
  };
};
