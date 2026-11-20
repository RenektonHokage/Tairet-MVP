import { Clock, Navigation, MapPin } from "lucide-react";
import { partyTime } from "./presentation";
import { profileDay, type ProfileParty } from "./presentation";
import { verifiedVenuePin } from "./verifiedVenuePins";
import { CatalogGeoCanvas } from "./CatalogGeoCanvas";
import { useMemo } from "react";

export function ProfileLocation({party}:{party:ProfileParty}) {
 const pin=verifiedVenuePin(party);
 const points=useMemo(()=>pin ? [{id:party.editorialEventId,title:party.title,pin}] : [],[party,pin]);
 return <section className="hp-section" aria-labelledby="hp-location-title"><h2 id="hp-location-title">Ubicación</h2>
  <div className="hp-location hp-location-panel">
   <div className="hp-location-map" role="region" aria-label={`Mapa de ${party.venue.name}`}>
    {pin?<CatalogGeoCanvas points={points} selectedId={party.editorialEventId} onSelect={()=>{}}/>:<div className="hp-map-fallback"><MapPin size={30} aria-hidden="true"/><p>Punto del mapa pendiente de confirmar.</p><p>{party.venue.address}</p></div>}
   </div>
   <div className="hp-location-copy"><h3>{party.venue.name}</h3><p>{[party.venue.zone,party.venue.city].filter(Boolean).join(" · ")}, Paraguay</p><p className="hp-help">{party.venue.address}</p>
    {pin?.precision==="reference"&&<p className="hp-help">El marcador es una referencia del lugar. Consultá el acceso con la organización.</p>}
    <div className="hp-location-hours"><div><span><Clock size={15} aria-hidden="true"/>Apertura</span><strong>{partyTime(party.startsAt,party.timezone)}</strong><small>{profileDay(party.startsAt,party.timezone)}</small></div>
     {party.endsAt&&<div><span><Clock size={15} aria-hidden="true"/>Cierre</span><strong>{partyTime(party.endsAt,party.timezone)}</strong><small>{profileDay(party.endsAt,party.timezone)}</small></div>}</div>
    {party.venue.directionsUrl&&<a className="hp-button" href={party.venue.directionsUrl} target="_blank" rel="noopener noreferrer"><Navigation size={16} aria-hidden="true"/>Cómo llegar</a>}
   </div>
  </div>
 </section>;
}
