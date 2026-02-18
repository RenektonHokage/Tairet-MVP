import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cardStyles } from "@/lib/design-tokens";

interface VenueCardSkeletonProps {
  className?: string;
}

export default function VenueCardSkeleton({ className = "" }: VenueCardSkeletonProps) {
  return (
    <Card className={`${cardStyles.base} h-full min-h-[320px] sm:min-h-[340px] flex flex-col overflow-hidden ${className}`}>
      <Skeleton className="h-40 sm:h-44 w-full rounded-none" />
      <div className="venue-card-content">
        <div className="mb-2 flex items-start justify-between gap-3">
          <Skeleton className="h-5 w-2/3" />
          <Skeleton className="h-5 w-12" />
        </div>
        <Skeleton className="mb-3 h-4 w-1/2" />
        <Skeleton className="mb-3 h-4 w-3/4" />
        <div className="flex-1" />
        <div className="flex flex-wrap gap-2">
          <Skeleton className="h-6 w-16 rounded-full" />
          <Skeleton className="h-6 w-20 rounded-full" />
          <Skeleton className="h-6 w-14 rounded-full" />
        </div>
      </div>
    </Card>
  );
}
