import * as React from "react";
import { Heart } from "lucide-react";

// Initial HTML and React share the approved hero; the video is client-managed.
export function HalloweenHero({mobilePoster,desktopPoster,logo,video,onExplore,onSaved}:{mobilePoster:string;desktopPoster:string;logo:string;video?:React.ReactNode;onExplore?:()=>void;onSaved?:()=>void}){
 return <section aria-labelledby="campaign-title" className="party-hero hwo-hero hw16-hero" data-media-frame="false" data-media-playing="false" data-manual-video="false">
  <div className="hwo-media"><picture className="tu-approved-poster"><source media="(max-width:860px)" srcSet={mobilePoster}/><img alt="" aria-hidden="true" className="fixed-hero-poster" decoding="async" loading="eager" {...{fetchpriority:"high"}} src={desktopPoster}/></picture>{video}</div>
  <div aria-hidden="true" className="h16-shade"/>
  <div className="h16-core"><p className="h16-eyebrow"><span>Guía de fiestas de</span><strong>Halloween</strong></p>
   <h1 className="h16-logo" id="campaign-title"><span className="sr-only">TAIRET Halloween</span><img alt="" aria-hidden="true" decoding="async" loading="eager" {...{fetchpriority:"high"}} height={704} src={logo} width={1408}/></h1>
   <p className="h16-location"><span>Asunción 2026</span></p><p className="h16-description"><span className="h16-description-lead">Guía histórica de Halloween</span>{" · "}<span className="h16-description-end">Eventos finalizados</span></p>
  </div>
  <div className="h16-bottom"><div aria-label="Participá de Halloween" className="h16-actions">
   <button className="h16-cta h16-cta-primary" type="button" onClick={onExplore}><span>Encontrá tu fiesta</span><span className="h16-arrow"><svg aria-hidden="true" viewBox="0 0 24 24"><path d="M12 5v14m-6-6 6 6 6-6"/></svg></span></button>
   <button className="h16-cta h16-cta-saved" type="button" onClick={onSaved}><Heart aria-hidden="true"/><span>Mi Halloween</span></button>
  </div></div>
 </section>;
}
