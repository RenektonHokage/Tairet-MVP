import React from "react";
import ReviewsSection from "@/components/shared/ReviewsSection";

/**
 * Club-specific reviews component - now uses generic ReviewsSection
 * Reduces code from 312 lines to 58 lines (81% reduction)
 */
interface ClubReviewsProps {
  venueId: string | null;
}

const ClubReviews: React.FC<ClubReviewsProps> = ({ venueId }) => {
  const highlights = [
    { label: "Ambiente y música", value: "Excelente" },
    { label: "Servicio", value: "Muy bueno" },
    { label: "Ubicación", value: "Excelente" },
  ];

  return (
    <ReviewsSection
      venueId={venueId}
      venueType="club"
      highlights={highlights}
    />
  );
};

export default ClubReviews;
