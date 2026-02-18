import { useCallback, useEffect, useMemo, useState } from "react";
import { getApiBase } from "@/lib/api";

export type ReviewVenueType = "bar" | "club";

export interface Review {
  id: string;
  venueId: string;
  venueType: ReviewVenueType;
  venueName: string | null;
  venueSlug: string | null;
  author: string;
  initials: string;
  rating: number;
  title: string | null;
  comment: string;
  date: string;
  createdAt: string;
  helpful: number;
  verified: boolean;
}

export interface CreateReviewInput {
  venueId: string;
  venueType: ReviewVenueType;
  displayName: string;
  rating: number;
  comment: string;
  title?: string;
  fingerprint: string;
}

interface ApiReviewItem {
  id: string;
  venue_id: string;
  venue_type: ReviewVenueType;
  venue_name: string | null;
  venue_slug: string | null;
  display_name: string;
  rating: number;
  title: string | null;
  comment: string;
  created_at: string;
}

interface ApiReviewsResponse {
  items: ApiReviewItem[];
  stats?: {
    totalReviews: number;
    averageRating: number;
  };
}

interface CreateReviewResult {
  ok: boolean;
  message?: string;
  code?: string;
  retryAfterSeconds?: number;
  scope?: "venue" | "daily";
}

interface UseReviewsOptions {
  venueId?: string;
  venueType?: ReviewVenueType;
  scope?: "venue" | "global";
  limit?: number;
  offset?: number;
  initialDisplayCount?: number;
  enabled?: boolean;
}

type FilterType = "all" | "positive" | "negative";

function getInitials(name: string) {
  return name
    .split(" ")
    .map((chunk) => chunk.trim())
    .filter(Boolean)
    .slice(0, 2)
    .map((chunk) => chunk[0]?.toUpperCase() || "")
    .join("");
}

function formatReviewDate(isoString: string) {
  const date = new Date(isoString);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const dayMs = 24 * 60 * 60 * 1000;

  if (!Number.isNaN(diffMs)) {
    const days = Math.floor(diffMs / dayMs);
    if (days <= 0) return "hoy";
    if (days === 1) return "hace 1 día";
    if (days < 7) return `hace ${days} días`;
  }

  return date.toLocaleDateString("es-PY", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function mapApiReview(item: ApiReviewItem): Review {
  return {
    id: item.id,
    venueId: item.venue_id,
    venueType: item.venue_type,
    venueName: item.venue_name,
    venueSlug: item.venue_slug,
    author: item.display_name,
    initials: getInitials(item.display_name),
    rating: item.rating,
    title: item.title,
    comment: item.comment,
    date: formatReviewDate(item.created_at),
    createdAt: item.created_at,
    helpful: 0,
    verified: false,
  };
}

export const useReviews = ({
  venueId,
  venueType,
  scope = "venue",
  limit = 30,
  offset = 0,
  initialDisplayCount = 5,
  enabled = true,
}: UseReviewsOptions) => {
  const [reviews, setReviews] = useState<Review[]>([]);
  const [averageRating, setAverageRating] = useState(0);
  const [totalReviews, setTotalReviews] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [filterType, setFilterType] = useState<FilterType>("all");

  const shouldFetch = enabled && (scope === "global" || Boolean(venueId));

  const fetchReviews = useCallback(async () => {
    if (!shouldFetch) return;

    setIsLoading(true);
    setError(null);

    try {
      const params = new URLSearchParams();
      params.set("limit", String(limit));
      params.set("offset", String(offset));

      if (scope === "venue" && venueId) {
        params.set("venue_id", venueId);
      }
      if (venueType) {
        params.set("venue_type", venueType);
      }

      const response = await fetch(`${getApiBase()}/reviews?${params.toString()}`);
      const payload: ApiReviewsResponse = await response.json();

      if (!response.ok) {
        throw new Error("No se pudieron cargar las reseñas.");
      }

      const mappedReviews = (payload.items || []).map(mapApiReview);
      setReviews(mappedReviews);

      if (payload.stats) {
        setAverageRating(payload.stats.averageRating || 0);
        setTotalReviews(payload.stats.totalReviews || 0);
      } else {
        const total = mappedReviews.length;
        const sum = mappedReviews.reduce((acc, review) => acc + review.rating, 0);
        setTotalReviews(total);
        setAverageRating(total > 0 ? Number((sum / total).toFixed(1)) : 0);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error al cargar reseñas.");
    } finally {
      setIsLoading(false);
    }
  }, [limit, offset, scope, shouldFetch, venueId, venueType]);

  useEffect(() => {
    fetchReviews();
  }, [fetchReviews]);

  const filteredReviews = useMemo(() => {
    switch (filterType) {
      case "positive":
        return reviews.filter((review) => review.rating >= 4);
      case "negative":
        return reviews.filter((review) => review.rating <= 3);
      default:
        return reviews;
    }
  }, [filterType, reviews]);

  const displayedReviews = useMemo(
    () => (showAllReviews ? filteredReviews : filteredReviews.slice(0, initialDisplayCount)),
    [filteredReviews, initialDisplayCount, showAllReviews]
  );

  const filterCounts = useMemo(
    () => ({
      all: reviews.length,
      positive: reviews.filter((review) => review.rating >= 4).length,
      negative: reviews.filter((review) => review.rating <= 3).length,
    }),
    [reviews]
  );

  const ratingDistribution = useMemo(() => {
    const total = reviews.length || 1;
    return [5, 4, 3, 2, 1].reduce<Record<number, number>>((acc, rating) => {
      const count = reviews.filter((review) => review.rating === rating).length;
      acc[rating] = Math.round((count / total) * 100);
      return acc;
    }, {});
  }, [reviews]);

  const createReview = useCallback(
    async (input: CreateReviewInput): Promise<CreateReviewResult> => {
      setIsSubmitting(true);
      setSubmitError(null);

      try {
        const response = await fetch(`${getApiBase()}/reviews`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "x-tairet-fp": input.fingerprint,
          },
          body: JSON.stringify({
            venue_id: input.venueId,
            venue_type: input.venueType,
            display_name: input.displayName,
            rating: input.rating,
            title: input.title || undefined,
            comment: input.comment,
            fingerprint: input.fingerprint,
          }),
        });

        const payload = await response.json().catch(() => ({}));

        if (!response.ok) {
          const message =
            typeof payload.message === "string"
              ? payload.message
              : "No se pudo publicar la reseña.";
          setSubmitError(message);
          return {
            ok: false,
            message,
            code: payload.error,
            retryAfterSeconds:
              typeof payload.retryAfterSeconds === "number" ? payload.retryAfterSeconds : undefined,
            scope: payload.scope,
          };
        }

        await fetchReviews();
        return { ok: true };
      } catch (err) {
        const message = err instanceof Error ? err.message : "No se pudo publicar la reseña.";
        setSubmitError(message);
        return { ok: false, message };
      } finally {
        setIsSubmitting(false);
      }
    },
    [fetchReviews]
  );

  return {
    reviews,
    displayedReviews,
    filterType,
    setFilterType,
    showAllReviews,
    toggleShowAll: () => setShowAllReviews((prev) => !prev),
    filterCounts,
    averageRating,
    totalReviews,
    ratingDistribution,
    isLoading,
    isSubmitting,
    error,
    submitError,
    clearSubmitError: () => setSubmitError(null),
    createReview,
    refetch: fetchReviews,
  };
};
