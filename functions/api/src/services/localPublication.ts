// Bar publication also applies to reviews. Club catalog visibility is a separate filter.
// Keep this expression static: PostgREST .or() accepts raw filter syntax.
export const PUBLIC_LOCAL_FILTER = "type.eq.club,and(type.eq.bar,is_published.eq.true)";

// Migration 052 permits true only for clubs, so bars always match this condition.
export const NOT_HIDDEN_FROM_CATALOG = { is_club_catalog_hidden: false } as const;
