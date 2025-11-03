import Link from "next/link";

export default function PublicPage() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center p-8">
      <h1 className="text-4xl font-bold mb-4">Tairet</h1>
      <p className="text-gray-600 mb-8">Sistema de gestión de eventos y reservas</p>
      <Link
        href="/panel"
        className="px-6 py-3 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
      >
        Ir al Panel
      </Link>
    </div>
  );
}

