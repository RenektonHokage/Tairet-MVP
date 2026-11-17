// B-01 controls bar discovery only. Club catalogs and Access keep their current contract.
// Keep this expression static: PostgREST .or() accepts raw filter syntax.
export const PUBLIC_LOCAL_FILTER = "type.eq.club,and(type.eq.bar,is_published.eq.true)";
