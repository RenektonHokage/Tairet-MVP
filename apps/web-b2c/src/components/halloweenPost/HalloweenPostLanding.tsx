import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ArrowUpRight } from "lucide-react";
import organizerPhoto from "../../assets/halloweenUi/organizer-c5d0b2a019b1.jpg";
// Approved hero/art and organizer form retained from ApprovedViews; post CTAs follow the approved post reference.
import { useTheme } from "next-themes";
import CampaignVideo from "../prelaunch/CampaignVideo";
import { HalloweenHero } from "./HalloweenHero";
import asset6 from "../../assets/prelaunch/approved-2ab8afd348886b.webp";
import asset7 from "../../assets/prelaunch/approved-b15c7968a89f92.webp";
import asset8 from "../../assets/prelaunch/approved-d13b7f90d07113.png";
export function HalloweenPostLanding({ catalog }: { catalog: ReactNode }) {
 const {resolvedTheme}=useTheme();
 return (<div className="tu-document" data-art="party" data-finish="luz" data-hero-brief="portada" data-hero-r6="silueta" data-hero-round="3" data-hero-study="elevada" data-map-round="2" data-theme={resolvedTheme === "light" ? "light" : "dark"}>
<div className="tu-body" data-hw-name="Halloween 2026" data-route="halloween" data-study-theme="dark">
<div>
<div className="hw-page" data-page="halloween">
<HalloweenHero mobilePoster={asset6} desktopPoster={asset7} logo={asset8} video={<CampaignVideo/>}
 onExplore={()=>document.getElementById("hp-catalog")?.scrollIntoView({behavior:matchMedia("(prefers-reduced-motion:reduce)").matches?"instant":"smooth"})}
 onSaved={()=>{document.getElementById("hp-saved")?.click();document.getElementById("hp-catalog")?.scrollIntoView();}}/>
<div className="hp hp-hub-surface">
{catalog}
<section className="hp-organizer-band" aria-labelledby="hp-organizer-title"><img className="hp-band-photo" src={organizerPhoto} alt="" aria-hidden="true" loading="lazy"/><div className="hp-shell hp-organizer-inner"><div><p className="hp-kicker">Para organizadores</p><h2 id="hp-organizer-title">Tu fiesta tiene<br/>que estar acá.</h2><p>Conocé cómo presentar tu evento en TAIRET.</p></div><Link className="hp-organizer-link" to="/para-locales/organizadores"><span>Información para<br/>organizadores</span><span className="hp-organizer-arrow"><ArrowUpRight size={28} aria-hidden="true"/></span></Link></div></section>
</div>
</div>
</div>

</div>
</div>);}
