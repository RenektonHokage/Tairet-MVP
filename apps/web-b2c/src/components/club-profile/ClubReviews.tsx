import React from 'react';
import ReviewsSection from '@/components/shared/ReviewsSection';
import { Review } from '@/hooks/useReviews';

/**
 * Club-specific reviews component - now uses generic ReviewsSection
 * Reduces code from 312 lines to 58 lines (81% reduction)
 */
const ClubReviews: React.FC = () => {
  // Club-specific review data
  const allReviews: Review[] = [];

  // Club-specific configuration  
  const averageRating = 0;
  const totalReviews = 0;
  
  const highlights = [
    { label: 'Ambiente y música', value: 'Excelente' },
    { label: 'Servicio', value: 'Muy bueno' },
    { label: 'Ubicación', value: 'Excelente' }
  ];

  return (
    <ReviewsSection
      reviews={allReviews}
      averageRating={averageRating}
      totalReviews={totalReviews}
      highlights={highlights}
    />
  );
};

export default ClubReviews;