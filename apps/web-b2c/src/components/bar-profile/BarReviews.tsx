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
  const highlights = [
    { label: "Ambiente y música", value: "Excelente" },
    { label: "Servicio", value: "Muy bueno" },
    { label: "Precios", value: "Razonable" },
  ];

  return (
    <ReviewsSection
      venueId={venueId}
      venueType="bar"
      highlights={highlights}
    />
  );
};

export default BarReviews;
