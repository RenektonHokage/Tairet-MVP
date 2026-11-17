import React from "react";
import ReviewsSection from "@/components/shared/ReviewsSection";

/**
 * Bar-specific reviews component - now uses generic ReviewsSection
 * Reduces code from 304 lines to 50 lines (83% reduction)
 */
interface BarReviewsProps {
  venueId: string | null;
}

const BarReviews: React.FC<BarReviewsProps> = ({ venueId }) => {

  return (
    <ReviewsSection
      venueId={venueId}
      venueType="bar"
      highlights={[]}
    />
  );
};

export default BarReviews;
