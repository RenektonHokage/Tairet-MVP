import { Link } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import Navbar from "@/components/layout/Navbar";
import tairetAppInterface from "@/assets/tairet-app-interface.jpg";
import nightlifeScene from "@/assets/nightlife-scene.jpg";


const QueEsTairet = () => {
  return (
    <div className="min-h-screen bg-white">
      <Navbar />
      {/* =========================================================
         1) SECCIÓN: DESCRIPCIÓN CORTA  (blanco, borde inferior negro)
         Orden fijo. Solo se permite ajustar textos y tamaños.
         ========================================================= */}
      <section
        aria-labelledby="desc-heading"
        className="py-16 lg:py-24 bg-white border-b-8 border-black"
      >
        <div className="container mx-auto px-6">
          <div className="max-w-4xl mx-auto text-center">
            <h2
              id="desc-heading"
              className="text-4xl md:text-6xl font-black text-black mb-8 leading-none"
            >
              {/* LOVABLE: Título corto y potente (máx 2 líneas) */}
              CONECTAMOS TU NOCHE
            </h2>

            <p className="text-xl md:text-2xl font-bold text-black leading-tight">
              {/* LOVABLE: Párrafo descriptivo. Mantener tono directo y claro. */}
              TAIRET conecta a los usuarios con bares y discotecas, mostrando
              fotos reales, horarios, ubicación, disponibilidad de mesas y
              promociones exclusivas. Todo en un solo lugar, sin complicaciones.
            </p>
          </div>
        </div>
      </section>

      {/* =========================================================
         2) SECCIÓN: CÓMO FUNCIONA (negro)
         Tres tarjetas numeradas 01 / 02 / 03. Mantener layout y hover.
         ========================================================= */}
      <section aria-labelledby="how-heading" className="py-16 lg:py-24 bg-black">
        <div className="container mx-auto px-6">
          <div className="text-center mb-16">
            <h2
              id="how-heading"
              className="text-4xl md:text-6xl font-black text-white mb-4 leading-none"
            >
              CÓMO FUNCIONA
            </h2>
            <p className="text-xl font-bold text-white">
              TRES PASOS PARA VIVIR TU NOCHE PERFECTA
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            {/* === PASO 1 === */}
            <div className="group relative bg-white border-8 border-black overflow-hidden hover:scale-105 transition-transform duration-300 cursor-pointer">
              {/* LOVABLE: Podés ajustar gradientes de acento */}
              <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-black/60 z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-purple-600 to-pink-600 opacity-20" />
              <div className="relative z-20 p-8 text-center min-h-[400px] flex flex-col justify-center">
                <div className="text-8xl font-black text-white mb-4 leading-none">01</div>
                <div className="w-16 h-16 bg-white mx-auto mb-6 flex items-center justify-center">
                  <div className="text-2xl font-black text-black">🔍</div>
                </div>
                <h3 className="text-2xl font-black text-white mb-4">ELEGÍ DÓNDE IR</h3>
                <p className="text-white font-bold text-lg">EXPLORÁ POR ZONAS O CATEGORÍAS</p>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white text-sm">DESCUBRÍ LOS MEJORES LUGARES DE TU CIUDAD</p>
                </div>
              </div>
            </div>

            {/* === PASO 2 === */}
            <div className="group relative bg-white border-8 border-black overflow-hidden hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-black/60 z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-blue-600 to-purple-600 opacity-20" />
              <div className="relative z-20 p-8 text-center min-h-[400px] flex flex-col justify-center">
                <div className="text-8xl font-black text-white mb-4 leading-none">02</div>
                <div className="w-16 h-16 bg-white mx-auto mb-6 flex items-center justify-center">
                  <div className="text-2xl font-black text-black">📅</div>
                </div>
                <h3 className="text-2xl font-black text-white mb-4">RESERVÁ TU MESA</h3>
                <p className="text-white font-bold text-lg">CONFIRMACIÓN POR CORREO CON QR</p>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white text-sm">PROCESO RÁPIDO Y SEGURO EN SEGUNDOS</p>
                </div>
              </div>
            </div>

            {/* === PASO 3 === */}
            <div className="group relative bg-white border-8 border-black overflow-hidden hover:scale-105 transition-transform duration-300 cursor-pointer">
              <div className="absolute inset-0 bg-gradient-to-br from-black/80 to-black/60 z-10" />
              <div className="absolute inset-0 bg-gradient-to-br from-pink-600 to-red-600 opacity-20" />
              <div className="relative z-20 p-8 text-center min-h-[400px] flex flex-col justify-center">
                <div className="text-8xl font-black text-white mb-4 leading-none">03</div>
                <div className="w-16 h-16 bg-white mx-auto mb-6 flex items-center justify-center">
                  <div className="text-2xl font-black text-black">🎉</div>
                </div>
                <h3 className="text-2xl font-black text-white mb-4">VIVÍ LA EXPERIENCIA</h3>
                <p className="text-white font-bold text-lg">MOSTRÁ TU QR EN EL INGRESO</p>
                <div className="mt-4 opacity-0 group-hover:opacity-100 transition-opacity duration-300">
                  <p className="text-white text-sm">ACCESO DIRECTO SIN ESPERAS NI COMPLICACIONES</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
         3) SECCIÓN: ¿QUÉ ES TAIRET? (negro, diseño diagonal cruzado)
         Desktop absoluto; Mobile apilado. Mantener orden.
         ========================================================= */}
      <section
        aria-labelledby="about-heading"
        className="py-16 lg:py-24 bg-black overflow-hidden"
      >
        <div className="container mx-auto px-6">
          {/* Desktop: Diagonal */}
          <div className="hidden lg:block relative min-h-[80vh]">
            {/* Arriba izquierda: Título */}
            <div className="absolute top-0 left-0 z-20">
              <h2
                id="about-heading"
                className="text-6xl xl:text-7xl font-black text-white leading-none"
              >
                ¿QUÉ ES
                <br />
                TAIRET?
              </h2>
            </div>

            {/* Arriba derecha: Imagen A */}
            <div className="absolute top-0 right-0 z-10">
              <div className="w-[32rem] h-96 overflow-hidden border-8 border-white">
                <img
                  src={tairetAppInterface}
                  alt="Interfaz de Tairet con reservas y promos"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  width={1024}
                  height={768}
                  sizes="(max-width: 1024px) 100vw, 512px"
                />
              </div>
            </div>

            {/* Abajo izquierda: Imagen B */}
            <div className="absolute bottom-16 left-0 z-10">
              <div className="w-[28rem] h-80 overflow-hidden border-8 border-white">
                <img
                  src={nightlifeScene}
                  alt="Escena de vida nocturna en Paraguay"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  width={960}
                  height={640}
                  sizes="(max-width: 1024px) 100vw, 480px"
                />
              </div>
            </div>

            {/* Abajo derecha: Texto */}
            <div className="absolute bottom-0 right-0 max-w-2xl z-20">
              <div className="bg-white p-8 border-8 border-white">
                <p className="text-xl xl:text-2xl font-black text-black leading-tight">
                  {/* LOVABLE: Podés afinar el copy, pero mantener tono directo. */}
                  Te ayudamos a descubrir bares y discotecas, leer reseñas
                  reales, acceder a promociones exclusivas y reservar mesas de
                  forma rápida y segura. Todo desde un solo lugar, sin
                  complicaciones.
                </p>
              </div>
            </div>
          </div>

          {/* Mobile: apilado (respetar orden) */}
          <div className="lg:hidden space-y-8">
            <h2 className="text-4xl md:text-5xl font-black text-white leading-none">
              ¿QUÉ ES
              <br />
              TAIRET?
            </h2>

            <div className="w-full max-w-md mx-auto">
              <div className="w-full h-64 overflow-hidden border-4 border-white">
                <img
                  src={tairetAppInterface}
                  alt="Interfaz de Tairet con reservas y promos"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  width={1024}
                  height={768}
                  sizes="100vw"
                />
              </div>
            </div>

            <div className="w-full max-w-sm mx-auto">
              <div className="w-full h-48 overflow-hidden border-4 border-white">
                <img
                  src={nightlifeScene}
                  alt="Escena de vida nocturna en Paraguay"
                  loading="lazy"
                  decoding="async"
                  className="w-full h-full object-cover"
                  width={960}
                  height={640}
                  sizes="100vw"
                />
              </div>
            </div>

            <div className="bg-white p-6 border-4 border-white">
              <p className="text-lg md:text-xl font-black text-black leading-tight">
                Te ayudamos a descubrir bares y discotecas, leer reseñas reales,
                acceder a promociones exclusivas y reservar mesas de forma
                rápida y segura. Todo desde un solo lugar, sin complicaciones.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* =========================================================
         4) HERO FINAL (blanco, borde superior negro)
         H1 único. Botón a la landing.
         ========================================================= */}
      <header className="min-h-screen flex items-center border-t-8 border-black">
        <div className="container mx-auto px-6">
          <div className="grid grid-cols-12 gap-8">
            <div className="col-span-12 lg:col-span-10">
              {/* H1 ÚNICO DE LA PÁGINA */}
              <h1 className="text-8xl md:text-9xl lg:text-[12rem] xl:text-[15rem] font-black leading-none tracking-tighter text-black">
                TAIRET
              </h1>
            </div>
            <div className="col-span-12 lg:col-span-2 lg:text-right">
              <div className="space-y-4">
                <div className="text-xs tracking-widest font-bold">PARAGUAY</div>
                <div className="text-xs tracking-widest font-bold">NIGHTLIFE</div>
                <div className="text-xs tracking-widest font-bold">2025</div>
              </div>
            </div>
          </div>

          <div className="mt-12 grid grid-cols-12 gap-8 items-end">
            <div className="col-span-12 md:col-span-6">
              <p className="text-xl md:text-2xl font-bold leading-tight max-w-md">
                LA PLATAFORMA DEFINITIVA PARA LA VIDA NOCTURNA EN PARAGUAY
              </p>
            </div>

            <div className="col-span-12 md:col-span-6 md:text-right">
              <Link
                to="/"
                className="inline-block bg-black text-white px-8 py-4 text-lg font-black tracking-wider hover:bg-gray-800 transition-colors border-4 border-black hover:border-gray-800"
              >
                EXPLORAR AHORA →
              </Link>
            </div>
          </div>
        </div>
      </header>

    </div>
  );
};

export default QueEsTairet;