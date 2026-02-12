import { Suspense } from "react";
import OrdersPageClient from "./OrdersPageClient";

export default function OrdersPage() {
  return (
    <Suspense fallback={<div className="p-6">Cargando...</div>}>
      <OrdersPageClient />
    </Suspense>
  );
}
