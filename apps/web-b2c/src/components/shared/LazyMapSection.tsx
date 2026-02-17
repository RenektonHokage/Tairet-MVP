import React, { Suspense, lazy } from "react";
import { Card } from "@/components/ui/card";
import type { MapSectionProps } from "./MapSection";

const MapSection = lazy(() => import("./MapSection"));

const MapSectionFallback: React.FC<{ isEvent?: boolean }> = ({ isEvent }) => (
  <section className="space-y-4 sm:space-y-6" aria-busy="true">
    <h2 className="text-xl sm:text-2xl font-bold text-foreground">
      {isEvent ? "Ubicación del Evento" : "Ubicación"}
    </h2>
    <Card className="overflow-hidden">
      <div className="min-h-[400px] animate-pulse bg-muted/50 flex items-center justify-center">
        <p className="text-sm text-muted-foreground">Cargando mapa...</p>
      </div>
    </Card>
  </section>
);

const LazyMapSection: React.FC<MapSectionProps> = (props) => (
  <Suspense fallback={<MapSectionFallback isEvent={props.isEvent} />}>
    <MapSection {...props} />
  </Suspense>
);

export default LazyMapSection;
