import React, { useCallback, useEffect, useRef, useState } from 'react';
import { MapPin, Navigation, Clock, Phone, Calendar } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { formatEventDate } from "@/lib/format";
import { buildGoogleMapsDirectionsUrl, geocodeAddressWithCache, type Coordinates } from '@/lib/geocode';

let mapboxGlPromise: Promise<typeof import("mapbox-gl")> | null = null;
let mapboxCssPromise: Promise<unknown> | null = null;

const loadMapboxGl = async () => {
  if (!mapboxGlPromise) {
    mapboxGlPromise = import("mapbox-gl");
  }
  return mapboxGlPromise;
};

const ensureMapboxCss = async () => {
  if (!mapboxCssPromise) {
    mapboxCssPromise = import("mapbox-gl/dist/mapbox-gl.css");
  }
  return mapboxCssPromise;
};

const MAP_DIAGNOSTICS_ENABLED =
  import.meta.env.DEV || import.meta.env.VITE_MAPBOX_DIAGNOSTICS === '1';

const STYLE_TILES_ERROR_MESSAGE = 'No se pudo cargar el mapa (tiles/estilo)';

type MapboxRuntimeError = {
  message: string;
  status?: number;
  resource?: string;
  isStyleOrTilesFailure: boolean;
};

const asRecord = (value: unknown): Record<string, unknown> =>
  typeof value === 'object' && value !== null ? (value as Record<string, unknown>) : {};

const readString = (...values: unknown[]): string | undefined => {
  for (const value of values) {
    if (typeof value === 'string') {
      const trimmed = value.trim();
      if (trimmed.length > 0) return trimmed;
    }
  }
  return undefined;
};

const readNumber = (...values: unknown[]): number | undefined => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;
    if (typeof value === 'string') {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }
  return undefined;
};

const parseMapboxRuntimeError = (event: unknown): MapboxRuntimeError => {
  const eventRecord = asRecord(event);
  const errorRecord = asRecord(eventRecord.error);
  const message =
    readString(errorRecord.message, eventRecord.message) ?? 'Error desconocido de Mapbox';
  const status = readNumber(errorRecord.status, eventRecord.status);
  const resource = readString(
    errorRecord.url,
    errorRecord.resource,
    eventRecord.sourceId,
    eventRecord.tile
  );
  const haystack = `${message} ${resource ?? ''}`.toLowerCase();
  const hasMapboxApiResource =
    haystack.includes('api.mapbox.com') ||
    haystack.includes('styles/v1') ||
    haystack.includes('/tiles/') ||
    haystack.includes('/glyphs/') ||
    haystack.includes('/sprite');
  const hasStyleTilesKeywords =
    haystack.includes('style') ||
    haystack.includes('tiles') ||
    haystack.includes('glyphs') ||
    haystack.includes('sprite') ||
    haystack.includes('forbidden') ||
    haystack.includes('unauthorized') ||
    haystack.includes('not found') ||
    haystack.includes('failed to load');
  const isTelemetryBlockedOnly =
    haystack.includes('events.mapbox.com') &&
    haystack.includes('err_blocked_by_client') &&
    !hasMapboxApiResource;
  const hasAuthStatus = status === 401 || status === 403 || status === 404;
  const isStyleOrTilesFailure =
    !isTelemetryBlockedOnly && (hasAuthStatus || hasMapboxApiResource || hasStyleTilesKeywords);

  return { message, status, resource, isStyleOrTilesFailure };
};

export interface MapSectionProps {
  venueId?: string;
  venue: string;
  location: string;
  address?: string;
  city?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  hours?: string[];
  phone?: string;
  additionalInfo?: string[];
  isEvent?: boolean;
  date?: string;
  time?: string;
}

const MapSection: React.FC<MapSectionProps> = ({ 
  venueId,
  venue,
  location,
  address,
  city,
  latitude,
  longitude,
  hours = [],
  phone = "(021) 555-123",
  additionalInfo = [],
  isEvent = false,
  date,
  time
}) => {
  const mapContainer = useRef<HTMLDivElement>(null);
  const map = useRef<import("mapbox-gl").Map | null>(null);
  const marker = useRef<import("mapbox-gl").Marker | null>(null);
  const mapboxglRef = useRef<typeof import("mapbox-gl").default | null>(null);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const prevCoordsRef = useRef<Coordinates | null>(null);
  const [mapError, setMapError] = useState<string | null>(null);
  const [mapOverlayError, setMapOverlayError] = useState<string | null>(null);
  const [mapOverlayDetail, setMapOverlayDetail] = useState<string | null>(null);
  const [resolvedCoords, setResolvedCoords] = useState<Coordinates | null>(null);
  const [isResolvingCoords, setIsResolvingCoords] = useState(false);

  const trimmedLocation = location?.trim() || "";
  const locationParts = trimmedLocation.includes("•")
    ? trimmedLocation.split("•").map((part) => part.trim()).filter(Boolean)
    : [];
  const zone = locationParts[0] || trimmedLocation;
  const cityFromLocation = locationParts[1] || "";
  const effectiveCity = city?.trim() || cityFromLocation;
  const safeLocation = zone || effectiveCity || "";
  const displayLocation = safeLocation ? `${safeLocation}, Paraguay` : "Paraguay";
  const displayZoneCity = zone && effectiveCity
    ? `${zone} • ${effectiveCity}`
    : zone || effectiveCity || "Ubicación no disponible";
  const displayAddress = address?.trim() || null;
  const providedCoords: Coordinates | null =
    Number.isFinite(longitude) && Number.isFinite(latitude) ? [Number(longitude), Number(latitude)] : null;

  const MAPBOX_TOKEN = import.meta.env.VITE_MAPBOX_TOKEN as string;

  const teardownMap = useCallback(() => {
    resizeObserver.current?.disconnect();
    resizeObserver.current = null;
    marker.current?.remove();
    marker.current = null;
    prevCoordsRef.current = null;
    map.current?.remove();
    map.current = null;
  }, []);

  useEffect(() => () => teardownMap(), [teardownMap]);

  useEffect(() => {
    let cancelled = false;

    if (providedCoords) {
      setResolvedCoords(providedCoords);
      setMapError(null);
      setMapOverlayError(null);
      setMapOverlayDetail(null);
      setIsResolvingCoords(false);
      return () => {
        cancelled = true;
      };
    }

    if (!MAPBOX_TOKEN) {
      setResolvedCoords(null);
      setMapError("Mapa no disponible");
      setMapOverlayError(null);
      setMapOverlayDetail(null);
      setIsResolvingCoords(false);
      return () => {
        cancelled = true;
      };
    }

    const hasAddressData = Boolean(displayAddress || zone || effectiveCity);
    if (!hasAddressData) {
      setResolvedCoords(null);
      setMapError("Ubicación no disponible");
      setMapOverlayError(null);
      setMapOverlayDetail(null);
      setIsResolvingCoords(false);
      return () => {
        cancelled = true;
      };
    }

    setIsResolvingCoords(true);
    setMapError(null);
    setMapOverlayError(null);
    setMapOverlayDetail(null);

    const controller = new AbortController();
    geocodeAddressWithCache({
      token: MAPBOX_TOKEN,
      venueId,
      venueName: venue,
      address: displayAddress,
      location: zone,
      city: effectiveCity || city,
      signal: controller.signal,
    })
      .then((coords) => {
        if (cancelled) return;
        if (coords) {
          setResolvedCoords(coords);
          setMapError(null);
        } else {
          setResolvedCoords(null);
          setMapError("Ubicación no disponible");
        }
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        if (error instanceof Error && error.name === "AbortError") return;
        setResolvedCoords(null);
        setMapError("No se pudo cargar el mapa");
      })
      .finally(() => {
        if (!cancelled) setIsResolvingCoords(false);
      });

    return () => {
      cancelled = true;
      controller.abort();
    };
  }, [MAPBOX_TOKEN, providedCoords, venueId, venue, displayAddress, zone, effectiveCity, city]);

  useEffect(() => {
    if (!mapContainer.current || !MAPBOX_TOKEN || !resolvedCoords || map.current) return;
    let cancelled = false;

    const initializeMap = async () => {
      try {
        await ensureMapboxCss();
        const mapboxglModule = await loadMapboxGl();
        const mapboxgl = mapboxglModule.default;
        if (cancelled || !mapContainer.current) return;
        mapboxglRef.current = mapboxgl;
        mapboxgl.accessToken = MAPBOX_TOKEN;

        const mapInstance = new mapboxgl.Map({
          container: mapContainer.current,
          style: 'mapbox://styles/mapbox/streets-v12',
          center: resolvedCoords,
          zoom: 15,
        });

        if (cancelled) {
          mapInstance.remove();
          return;
        }

        map.current = mapInstance;
        mapInstance.addControl(new mapboxgl.NavigationControl(), 'top-right');

        mapInstance.on('load', () => {
          mapInstance.dragPan.enable();
          mapInstance.scrollZoom.enable();
          mapInstance.doubleClickZoom.enable();
          mapInstance.touchZoomRotate.enable();
          mapInstance.keyboard.enable();
          mapInstance.dragRotate.disable();
        });

        mapInstance.on('style.load', () => {
          if (MAP_DIAGNOSTICS_ENABLED) {
            console.info(`[MapSection] style.load ${venue}`);
          }
          setMapOverlayError(null);
          setMapOverlayDetail(null);
        });

        mapInstance.on('idle', () => {
          if (MAP_DIAGNOSTICS_ENABLED) {
            console.info(`[MapSection] idle ${venue}`);
          }
        });

        mapInstance.on('error', (event) => {
          const parsedError = parseMapboxRuntimeError(event);
          if (MAP_DIAGNOSTICS_ENABLED) {
            console.warn('[MapSection] map.error', {
              message: parsedError.message,
              status: parsedError.status,
              resource: parsedError.resource,
            });
          }

          if (parsedError.isStyleOrTilesFailure) {
            const diagnostic =
              `${parsedError.status ? `[${parsedError.status}] ` : ''}${parsedError.message}` +
              (parsedError.resource ? ` (${parsedError.resource})` : '');
            setMapOverlayError(STYLE_TILES_ERROR_MESSAGE);
            setMapOverlayDetail(diagnostic);
          }
        });

        marker.current = new mapboxgl.Marker({ color: '#8B5CF6' })
          .setLngLat(resolvedCoords)
          .setPopup(new mapboxgl.Popup().setHTML(`<strong>${venue}</strong><br/>${displayAddress ?? displayLocation}`))
          .addTo(mapInstance);
        prevCoordsRef.current = resolvedCoords;

        requestAnimationFrame(() => {
          if (!map.current) return;
          map.current.resize();
        });

        if (typeof ResizeObserver !== 'undefined' && mapContainer.current) {
          resizeObserver.current?.disconnect();
          resizeObserver.current = new ResizeObserver(() => {
            const mapInstanceRef = map.current;
            if (!mapInstanceRef) return;
            mapInstanceRef.resize();
          });
          resizeObserver.current.observe(mapContainer.current);
        }

        setMapError(null);
        setMapOverlayError(null);
        setMapOverlayDetail(null);
      } catch (error) {
        if (!cancelled) {
          if (MAP_DIAGNOSTICS_ENABLED) {
            console.error('Error initializing map:', error);
          }
          setMapError('No se pudo cargar el mapa');
        }
      }
    };

    initializeMap();

    return () => {
      cancelled = true;
    };
  }, [venue, displayLocation, displayAddress, MAPBOX_TOKEN, resolvedCoords]);

  useEffect(() => {
    if (!map.current || !resolvedCoords || !mapboxglRef.current) return;

    const popupHtml = `<strong>${venue}</strong><br/>${displayAddress ?? displayLocation}`;
    if (!marker.current) {
      marker.current = new mapboxglRef.current.Marker({ color: '#8B5CF6' })
        .setLngLat(resolvedCoords)
        .setPopup(new mapboxglRef.current.Popup().setHTML(popupHtml))
        .addTo(map.current);
      prevCoordsRef.current = resolvedCoords;
      return;
    }

    marker.current.setPopup(new mapboxglRef.current.Popup().setHTML(popupHtml));
    const prevCoords = prevCoordsRef.current;
    const coordsChanged =
      !prevCoords ||
      Math.abs(prevCoords[0] - resolvedCoords[0]) > 0.00001 ||
      Math.abs(prevCoords[1] - resolvedCoords[1]) > 0.00001;
    if (!coordsChanged) return;

    marker.current.setLngLat(resolvedCoords);
    prevCoordsRef.current = resolvedCoords;

    const currentZoom = map.current.getZoom();
    const nextZoom = Number.isFinite(currentZoom)
      ? Math.max(12, Math.min(18, currentZoom))
      : 15;
    map.current.easeTo({
      center: resolvedCoords,
      zoom: nextZoom,
      duration: 450,
      essential: true,
    });
  }, [resolvedCoords, venue, displayAddress, displayLocation]);

  const handleGetDirections = () => {
    const url = buildGoogleMapsDirectionsUrl({
      coords: resolvedCoords,
      venueName: venue,
      address: displayAddress,
      location: zone,
      city: effectiveCity || city,
    });
    window.open(url, "_blank", "noopener,noreferrer");
  };

  return (
    <section className="space-y-4 sm:space-y-6">
      <h2 className="text-xl sm:text-2xl font-bold text-foreground">
        {isEvent ? 'Ubicación del Evento' : 'Ubicación'}
      </h2>
      
      <div className="grid gap-4 lg:gap-6 lg:grid-cols-3">
        {/* Map */}
        <div className="lg:col-span-2">
          <Card className="overflow-hidden h-full">
            {MAPBOX_TOKEN && !mapError && resolvedCoords ? (
              <div className="relative h-full min-h-[400px]">
                <div
                  ref={mapContainer}
                  className="h-full min-h-[400px] pointer-events-auto"
                />
                {mapOverlayError && (
                  <div className="absolute inset-0 z-20 flex items-center justify-center bg-background/90 px-6 text-center">
                    <div className="max-w-md space-y-2">
                      <p className="text-sm font-medium text-foreground">{mapOverlayError}</p>
                      <p className="text-xs text-muted-foreground">
                        Revisá adblock/extensiones y las restricciones del token de Mapbox (Allowed URLs/scopes).
                      </p>
                      {MAP_DIAGNOSTICS_ENABLED && mapOverlayDetail && (
                        <p className="text-[11px] text-muted-foreground/80 break-words">
                          Detalle técnico: {mapOverlayDetail}
                        </p>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="h-full min-h-[400px] flex items-center justify-center bg-muted">
                <p className="text-muted-foreground text-sm">
                  {isResolvingCoords ? "Cargando ubicación..." : mapError ?? "Ubicación no disponible"}
                </p>
              </div>
            )}
          </Card>
        </div>
        
        {/* Info */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-4">
              <div className="space-y-3">
                <div className="flex items-start gap-3">
                  <MapPin className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {isEvent ? 'Lugar del Evento' : 'Dirección'}
                    </p>
                    <p className="text-sm text-muted-foreground">{displayZoneCity}</p>
                  </div>
                </div>
                
                {isEvent && date && (
                  <div className="flex items-start gap-3">
                    <Calendar className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                    <div>
                      <p className="font-medium text-foreground">Fecha del Evento</p>
                      <div className="text-sm text-muted-foreground space-y-1">
                        <p>{formatEventDate(date)}</p>
                        <p className="text-green-600 font-medium">Próximo evento</p>
                      </div>
                    </div>
                  </div>
                )}
                
                <div className="flex items-start gap-3">
                  <Clock className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">
                      {isEvent ? 'Horario' : 'Horarios'}
                    </p>
                    <div className="text-sm text-muted-foreground space-y-1">
                      {isEvent && time ? (
                        <p>Inicio: {time}hs</p>
                      ) : hours.length > 0 ? (
                        hours.map((hour, index) => (
                          <p key={index}>{hour}</p>
                        ))
                      ) : (
                        <>
                          <p>Lun - Jue: 18:00 - 02:00</p>
                          <p>Vie - Sáb: 18:00 - 03:00</p>
                          <p>Dom: Cerrado</p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
                
                <div className="flex items-start gap-3">
                  <Phone className="w-5 h-5 text-primary mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="font-medium text-foreground">Contacto</p>
                    <p className="text-sm text-muted-foreground">{phone}</p>
                  </div>
                </div>
              </div>
              
              <div className="pt-2 space-y-2">
                <Button className="w-full" variant="outline" onClick={handleGetDirections}>
                  <Navigation className="w-4 h-4 mr-2" />
                  Cómo llegar
                </Button>
                <Button className="w-full" variant="outline" onClick={() => window.open(`tel:${phone}`)}>
                  <Phone className="w-4 h-4 mr-2" />
                  {isEvent ? 'Llamar al local' : 'Llamar'}
                </Button>
              </div>
            </CardContent>
          </Card>
          
          <Card>
            <CardContent className="p-4">
              <h3 className="font-medium text-foreground mb-3">
                {isEvent ? 'Información importante' : 'Información adicional'}
              </h3>
              <div className="space-y-2 text-sm text-muted-foreground">
                {additionalInfo.length > 0 ? (
                  additionalInfo.map((info, index) => (
                    <p key={index}>• {info}</p>
                  ))
                ) : isEvent ? (
                  <>
                    <p>• Entrada solo con documento de identidad</p>
                    <p>• Código de vestimenta elegante</p>
                    <p>• Llegá temprano para mejores ubicaciones</p>
                    <p>• Estacionamiento disponible</p>
                    <p>• Evento sujeto a capacidad máxima</p>
                  </>
                ) : (
                  <>
                    <p>• Estacionamiento disponible</p>
                    <p>• Acceso para personas con discapacidad</p>
                    <p>• WiFi gratuito</p>
                    <p>• Aceptamos tarjetas de crédito</p>
                    <p>• Ambiente climatizado</p>
                  </>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </section>
  );
};

export default MapSection;
