import React from 'react';
import ReviewsSection from '@/components/shared/ReviewsSection';
import { Review } from '@/hooks/useReviews';

/**
 * Bar-specific reviews component - now uses generic ReviewsSection
 * Reduces code from 304 lines to 50 lines (83% reduction)
 */
const BarReviews: React.FC = () => {
  // Bar-specific review data
  const allReviews: Review[] = [];

  // Bar-specific configuration
  const averageRating = 0;
  const totalReviews = 0;
  
  const highlights = [
    { label: 'Ambiente y música', value: 'Excelente' },
    { label: 'Servicio', value: 'Muy bueno' },
    { label: 'Precios', value: 'Razonable' }
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

export default BarReviews;