/**
 * Centralized design tokens and utility classes
 * Reduces hardcoded class repetition across components
 */

// Common card styles
export const cardStyles = {
  base: "bg-card text-card-foreground border-border/50 hover:shadow-lg transition-all duration-200",
  interactive: "cursor-pointer hover:scale-[1.01] active:scale-[0.99]",
  compact: "p-3 sm:p-4",
  comfortable: "p-4 sm:p-6",
  spacious: "p-6 sm:p-8"
} as const;

// Rating display utilities
export const ratingStyles = {
  star: "w-4 h-4 text-yellow-400 fill-yellow-400",
  starSmall: "w-3 h-3 text-yellow-400 fill-yellow-400",
  starMuted: "w-3 h-3 text-muted-foreground/30",
  container: "flex items-center gap-1"
} as const;

// Button variants for common patterns
export const buttonStyles = {
  filter: "h-9 px-3 bg-muted/50 hover:bg-muted text-muted-foreground hover:text-foreground border-0",
  badge: "inline-flex items-center gap-1 bg-muted/50 text-muted-foreground text-xs px-2 py-1 rounded-md",
  action: "text-sm text-muted-foreground hover:text-primary transition-colors"
} as const;

// Layout patterns
export const layoutStyles = {
  section: "space-y-4 sm:space-y-6",
  grid: "grid gap-4 sm:gap-6",
  flexBetween: "flex items-center justify-between",
  flexCenter: "flex items-center justify-center",
  responsiveGrid: "grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 sm:gap-6"
} as const;

// Avatar utilities
export const avatarStyles = {
  fallback: "bg-primary/10 text-primary font-medium",
  sizes: {
    sm: "w-8 h-8",
    md: "w-10 h-10", 
    lg: "w-12 h-12"
  }
} as const;

// Typography scale
export const textStyles = {
  title: "text-xl sm:text-2xl font-bold text-foreground",
  subtitle: "text-lg font-semibold text-foreground",
  body: "text-muted-foreground",
  small: "text-sm text-muted-foreground",
  caption: "text-xs text-muted-foreground"
} as const;