import { useState, useMemo } from 'react';

export interface Review {
  id: number;
  author: string;
  rating: number;
  comment: string;
  date: string;
  helpful: number;
  verified: boolean;
}

interface UseReviewsOptions {
  reviews: Review[];
  averageRating: number;
  totalReviews: number;
  initialDisplayCount?: number;
}

/**
 * Custom hook for managing reviews display and filtering logic
 * Reduces code duplication between BarReviews and ClubReviews
 */
export const useReviews = ({ 
  reviews, 
  averageRating, 
  totalReviews,
  initialDisplayCount = 5 
}: UseReviewsOptions) => {
  const [showAllReviews, setShowAllReviews] = useState(false);
  const [filterType, setFilterType] = useState<'all' | 'positive' | 'negative'>('all');

  // Memoized filtered reviews for performance
  const filteredReviews = useMemo(() => {
    switch (filterType) {
      case 'positive':
        return reviews.filter(review => review.rating >= 4);
      case 'negative':
        return reviews.filter(review => review.rating <= 3);
      default:
        return reviews;
    }
  }, [reviews, filterType]);

  // Memoized displayed reviews
  const displayedReviews = useMemo(() => 
    showAllReviews ? filteredReviews : filteredReviews.slice(0, initialDisplayCount),
    [filteredReviews, showAllReviews, initialDisplayCount]
  );

  // Memoized filter counts for performance
  const filterCounts = useMemo(() => ({
    all: reviews.length,
    positive: reviews.filter(r => r.rating >= 4).length,
    negative: reviews.filter(r => r.rating <= 3).length,
  }), [reviews]);

  const toggleShowAll = () => setShowAllReviews(!showAllReviews);

  return {
    displayedReviews,
    filterType,
    setFilterType,
    showAllReviews,
    toggleShowAll,
    filterCounts,
    averageRating,
    totalReviews,
  };
};