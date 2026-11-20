import { useEffect, useMemo } from "react";
import { Link, useLocation, useNavigate, useParams } from "react-router-dom";
import { PublicLayout } from "../prelaunch/PublicLayout";
import { archivedParties, informationPriceLabel, informationPrices, informationSummary, type ArchivedParty } from "./archive";
import { CatalogView } from "./HalloweenCatalog";
import { HalloweenPostLanding } from "./HalloweenPostLanding";
import { HalloweenProfileFrame } from "./HalloweenProfileFrame";
import { ProfileTables } from "./ProfileTables";
import { externalBatchLabel, externalOfferDescription } from "./presentation";
import "../prelaunch/approved-halloween.css";

function ArchivedProfile({ party, onBack }: { party: ArchivedParty; onBack: () => void }) {
  const event = party.information;
  const prices = informationPrices(event);
  const summary = informationSummary(party);
  const price = summary.amount ? informationPriceLabel({ kind: "confirmed", amount: summary.amount }) : summary.label;
  const provider = "provider" in event.ticketing ? event.ticketing.provider : undefined;
  const batch = provider ? externalBatchLabel(prices) : "";
  return <HalloweenProfileFrame party={party} onBack={onBack} admissionNote={event.admissionNote}
    priceLabel={price} priceCaption={prices.length > 1 ? "Entradas de 2026 desde" : "Entradas de 2026"}>
    <section className="hp-section" id="entradas">
      <h2>Entradas</h2>
      <div className="hp-ticket-box">
        <header><div className="hp-ticket-heading"><div><h3>Edición 2026 · Evento finalizado</h3>
          <p>Precios publicados para esta fecha.{provider ? " La ticketera fue " + provider + "." : ""}</p></div></div>
          {batch && <span>{batch}</span>}</header>
        {prices.map(row => {
          const detail = provider ? externalOfferDescription(row.description, provider, batch) : row.description;
          return <div className="hp-ticket-row" key={row.id}>
            <div><h4>{row.label}</h4>{detail && <p>{detail}</p>}</div><strong>{informationPriceLabel(row.price)}</strong>
          </div>;
        })}
        {!prices.length && <p className="hp-help">Precio a confirmar en la publicación original.</p>}
        {"batches" in event.ticketing && event.ticketing.batches?.some(batch => batch.status !== "current") &&
          <details className="hp-batches"><summary>Otras tandas de 2026</summary>
            {event.ticketing.batches.filter(batch => batch.status !== "current").map(batch =>
              <p key={batch.id}>{batch.label} · {batch.prices.map(row => row.label + ": " + informationPriceLabel(row.price)).join(" / ")}</p>)}
          </details>}
        {"door" in event.ticketing && event.ticketing.mode !== "door" &&
          <aside className="hp-door"><h3>En puerta</h3>{event.ticketing.door.prices.map(row =>
            <p key={row.id}>{row.label} · {informationPriceLabel(row.price)}</p>)}</aside>}
      </div>
    </section>
    <ProfileTables availability={event.tablesAvailability} tables={event.tables.map(table => ({
      ...table, priceLabel: informationPriceLabel(table.price, "Mesa"),
    }))} />
  </HalloweenProfileFrame>;
}

export default function HalloweenArchive() {
  const { slug } = useParams();
  const location = useLocation();
  const navigate = useNavigate();
  const query = new URLSearchParams(location.search);
  const selection = (query.get("seleccion") ?? "").split(",").filter(Boolean).slice(0, 30);
  const q = query.get("q")?.trim() ?? "";
  const searchRequest = useMemo(() => q ? { value: q, sequence: 1 } : undefined, [q]);
  const party = slug ? archivedParties.find(row => row.slug === slug) : undefined;

  useEffect(() => {
    if (q && !slug) {
      const frame = requestAnimationFrame(() => document.getElementById("hp-catalog")?.scrollIntoView());
      return () => cancelAnimationFrame(frame);
    }
  }, [q, slug, location.key]);

  const returnToGuide = () => {
    if (location.state?.fromHalloweenGuide) navigate(-1);
    else navigate("/halloween");
  };
  return <PublicLayout page="halloween" title={party?.title ?? "Guía de Halloween 2026"}>
    {slug ? (party ? <ArchivedProfile party={party} onBack={returnToGuide} /> :
      <section className="hp hp-catalog"><div className="hp-shell">
        <h1>Fiesta no disponible</h1><Link className="hp-button" to="/halloween">Volver a las fiestas</Link>
      </div></section>) :
      <HalloweenPostLanding catalog={<CatalogView key={location.key} parties={archivedParties}
        initialSelection={selection} getPrice={informationSummary} searchRequest={searchRequest}
        onSelect={row => navigate("/halloween/fiesta/" + row.slug, { state: { fromHalloweenGuide: true } })} />} />}
  </PublicLayout>;
}
