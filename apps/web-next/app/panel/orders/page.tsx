"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/supabase";
import { getApiBase, getAuthHeaders } from "@/lib/api";

interface OrderItem {
  id: string;
  status: string;
  used_at: string | null;
  checkin_token: string | null;
  customer_name: string | null;
  customer_last_name: string | null;
  customer_email: string | null;
  customer_document: string | null;
  created_at?: string;
}

interface OrdersResponse {
  items: OrderItem[];
  count: number;
}

type SearchType = "email" | "document";

export default function OrdersPage() {
  const router = useRouter();

  const [isAuthenticated, setIsAuthenticated] = useState<boolean | null>(null);

  // Historial de check-ins
  const [checkins, setCheckins] = useState<OrderItem[]>([]);
  const [loadingCheckins, setLoadingCheckins] = useState(false);
  const [checkinsError, setCheckinsError] = useState<string | null>(null);

  // Búsqueda
  const [searchType, setSearchType] = useState<SearchType>("email");
  const [searchValue, setSearchValue] = useState("");
  const [searchResults, setSearchResults] = useState<OrderItem[] | null>(null);
  const [loadingSearch, setLoadingSearch] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);

  // Copiar token
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Verificar sesión al montar
  useEffect(() => {
    const checkSession = async () => {
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();

        if (!session) {
          router.push("/panel/login");
          return;
        }

        setIsAuthenticated(true);
      } catch (err) {
        console.error("Error checking session:", err);
        router.push("/panel/login");
      }
    };

    checkSession();
  }, [router]);

  // Cargar check-ins al autenticarse
  useEffect(() => {
    if (isAuthenticated) {
      loadCheckins();
    }
  }, [isAuthenticated]);

  const loadCheckins = useCallback(async () => {
    setLoadingCheckins(true);
    setCheckinsError(null);

    try {
      const headers = await getAuthHeaders();
      const response = await fetch(`${getApiBase()}/panel/checkins?limit=20`, {
        method: "GET",
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error ${response.status}`);
      }

      const data: OrdersResponse = await response.json();
      setCheckins(data.items);
    } catch (err) {
      setCheckinsError(err instanceof Error ? err.message : "Error al cargar check-ins");
    } finally {
      setLoadingCheckins(false);
    }
  }, []);

  const handleSearch = async () => {
    if (!searchValue.trim()) return;

    setLoadingSearch(true);
    setSearchError(null);
    setSearchResults(null);

    try {
      const headers = await getAuthHeaders();
      const param = searchType === "email" ? "email" : "document";
      const url = `${getApiBase()}/panel/orders/search?${param}=${encodeURIComponent(searchValue.trim())}`;

      const response = await fetch(url, {
        method: "GET",
        credentials: "include",
        headers,
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        throw new Error(data.error || `Error ${response.status}`);
      }

      const data: OrdersResponse = await response.json();
      setSearchResults(data.items);
    } catch (err) {
      setSearchError(err instanceof Error ? err.message : "Error en búsqueda");
    } finally {
      setLoadingSearch(false);
    }
  };

  const handleCopyToken = async (token: string, id: string) => {
    try {
      await navigator.clipboard.writeText(token);
      setCopiedId(id);
      setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // Fallback silencioso
    }
  };

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return "-";
    return new Date(dateStr).toLocaleString();
  };

  const getStatusBadge = (status: string, usedAt: string | null) => {
    if (usedAt) {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded bg-blue-100 text-blue-800">
          Usado
        </span>
      );
    }
    if (status === "paid") {
      return (
        <span className="px-2 py-1 text-xs font-medium rounded bg-green-100 text-green-800">
          Pagado
        </span>
      );
    }
    return (
      <span className="px-2 py-1 text-xs font-medium rounded bg-gray-100 text-gray-700">
        {status}
      </span>
    );
  };

  const renderOrderRow = (order: OrderItem) => (
    <tr key={order.id} className="border-b border-gray-100">
      <td className="px-3 py-2 text-sm">{getStatusBadge(order.status, order.used_at)}</td>
      <td className="px-3 py-2 text-sm text-gray-900">{formatDate(order.used_at)}</td>
      <td className="px-3 py-2 text-sm text-gray-900">
        {order.customer_name || "-"} {order.customer_last_name || ""}
      </td>
      <td className="px-3 py-2 text-sm text-gray-600">{order.customer_email || "-"}</td>
      <td className="px-3 py-2 text-sm text-gray-600">{order.customer_document || "-"}</td>
      <td className="px-3 py-2 text-sm">
        {order.checkin_token ? (
          <div className="flex items-center gap-1">
            <code className="text-xs bg-gray-100 px-1 py-0.5 rounded truncate max-w-[80px]">
              {order.checkin_token.slice(0, 8)}...
            </code>
            <button
              onClick={() => handleCopyToken(order.checkin_token!, order.id)}
              className="px-2 py-1 text-xs bg-gray-200 rounded hover:bg-gray-300"
              title="Copiar token completo"
            >
              {copiedId === order.id ? "✓" : "📋"}
            </button>
          </div>
        ) : (
          "-"
        )}
      </td>
    </tr>
  );

  // Mostrar loading mientras se verifica la sesión
  if (isAuthenticated === null) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-center">
          <p className="text-gray-600">Verificando sesión...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <h2 className="text-3xl font-bold">Órdenes & Check-ins</h2>
          <Link
            href="/panel"
            className="px-4 py-2 bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 text-sm font-medium"
          >
            ← Volver al Dashboard
          </Link>
        </div>
      </div>

      {/* Búsqueda */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-semibold mb-4">Buscar Órdenes</h3>

        <div className="flex flex-wrap gap-4 items-end">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Buscar por</label>
            <div className="flex gap-2">
              <button
                onClick={() => setSearchType("email")}
                className={`px-3 py-2 text-sm rounded-md ${
                  searchType === "email"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Email
              </button>
              <button
                onClick={() => setSearchType("document")}
                className={`px-3 py-2 text-sm rounded-md ${
                  searchType === "document"
                    ? "bg-blue-600 text-white"
                    : "bg-gray-200 text-gray-700 hover:bg-gray-300"
                }`}
              >
                Documento
              </button>
            </div>
          </div>

          <div className="flex-1 min-w-[200px]">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              {searchType === "email" ? "Email" : "Documento"}
            </label>
            <input
              type={searchType === "email" ? "email" : "text"}
              value={searchValue}
              onChange={(e) => setSearchValue(e.target.value)}
              placeholder={searchType === "email" ? "correo@ejemplo.com" : "12345678"}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            />
          </div>

          <button
            onClick={handleSearch}
            disabled={loadingSearch || !searchValue.trim()}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50"
          >
            {loadingSearch ? "Buscando..." : "Buscar"}
          </button>
        </div>

        {searchError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-md">
            <p className="text-sm text-red-800">{searchError}</p>
          </div>
        )}

        {searchResults !== null && (
          <div className="mt-4">
            <p className="text-sm text-gray-600 mb-2">
              {searchResults.length} resultado{searchResults.length !== 1 ? "s" : ""}
            </p>
            {searchResults.length > 0 ? (
              <div className="overflow-x-auto">
                <table className="min-w-full">
                  <thead className="bg-gray-50">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usado</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                    </tr>
                  </thead>
                  <tbody>{searchResults.map(renderOrderRow)}</tbody>
                </table>
              </div>
            ) : (
              <p className="text-sm text-gray-500">No se encontraron órdenes.</p>
            )}
          </div>
        )}
      </div>

      {/* Últimos Check-ins */}
      <div className="bg-white p-6 rounded-lg shadow">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold">Últimos 20 Check-ins</h3>
          <button
            onClick={loadCheckins}
            disabled={loadingCheckins}
            className="px-3 py-1 text-sm bg-gray-200 text-gray-700 rounded-md hover:bg-gray-300 disabled:opacity-50"
          >
            {loadingCheckins ? "Cargando..." : "🔄 Refrescar"}
          </button>
        </div>

        {checkinsError && (
          <div className="p-3 bg-red-50 border border-red-200 rounded-md mb-4">
            <p className="text-sm text-red-800">{checkinsError}</p>
          </div>
        )}

        {loadingCheckins && checkins.length === 0 ? (
          <p className="text-sm text-gray-500">Cargando check-ins...</p>
        ) : checkins.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Estado</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Usado</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Nombre</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Email</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Documento</th>
                  <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase">Token</th>
                </tr>
              </thead>
              <tbody>{checkins.map(renderOrderRow)}</tbody>
            </table>
          </div>
        ) : (
          <p className="text-sm text-gray-500">No hay check-ins registrados.</p>
        )}
      </div>
    </div>
  );
}
