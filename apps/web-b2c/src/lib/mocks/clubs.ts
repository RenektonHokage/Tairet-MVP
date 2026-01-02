// Centralized mock data for clubs
import dlirioVideo from "@/assets/dlirio-video.mp4";
import bailongoPromo from "@/assets/bailongo-promo.jpg";
import formulaPromo from "@/assets/formula-promo.jpg";
import tragosFreshPromo from "@/assets/tragos-fresh-promo.jpg";
import dlirioGallery1 from "@/assets/dlirio-gallery-1.jpg";
import dlirioGallery2 from "@/assets/dlirio-gallery-2.jpg";
import dlirioGallery3 from "@/assets/dlirio-gallery-3.jpg";
import dlirioGallery4 from "@/assets/dlirio-gallery-4.jpg";

export const mockClubData = {
  morgan: {
    name: "Morgan",
    images: ["/images/bar.jpg", "/images/bar.jpg", "/images/bar.jpg"],
    video: undefined,
    ageRestriction: "+18",
    schedule: "23:00–06:00",
    genre: "Reggaeton",
    entryPrice: "50.000 Gs",
    tickets: [{
      id: "free-pass-morgan",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 50000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 150000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 250000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial", "Ubicación privilegiada"]
    }, {
      id: "premium",
      name: "Mesa Premium",
      capacity: 8,
      price: 350000,
      drinks: ["Botella ultra premium", "10 mixers", "Hielera y vasos", "Servicio VIP", "Vista panorámica"]
    }, {
      id: "sofa",
      name: "Sofá Área Preferencial",
      capacity: 10,
      price: 450000,
      drinks: ["2 botellas premium", "15 mixers", "Servicio completo", "Área exclusiva", "Acceso directo"]
    }],
    promotions: [{
      id: "d4e5f6a7-b8c9-4012-d345-678901234567",
      title: "Ladies Night",
      image: "/images/bar.jpg"
    }, {
      id: "e5f6a7b8-c9d0-4123-e456-789012345678",
      title: "Happy Hour",
      image: "/images/bar.jpg"
    }, {
      id: "f6a7b8c9-d0e1-4234-f567-890123456789",
      title: "Student Night",
      image: "/images/bar.jpg"
    }]
  },
  celavie: {
    name: "Celavie",
    images: ["/images/bar.jpg", "/images/bar.jpg"],
    video: undefined,
    ageRestriction: "+18",
    schedule: "23:00–06:00",
    genre: "Mix",
    entryPrice: "60.000 Gs",
    tickets: [{
      id: "free-pass-celavie",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 60000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 180000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 280000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial", "Ubicación privilegiada"]
    }, {
      id: "premium",
      name: "Mesa Premium",
      capacity: 8,
      price: 380000,
      drinks: ["Botella ultra premium", "10 mixers", "Hielera y vasos", "Servicio VIP", "Vista panorámica"]
    }, {
      id: "sofa",
      name: "Sofá Área Preferencial",
      capacity: 10,
      price: 480000,
      drinks: ["2 botellas premium", "15 mixers", "Servicio completo", "Área exclusiva", "Acceso directo"]
    }],
    promotions: [{
      id: "a7b8c9d0-e1f2-4345-a678-901234567890",
      title: "Ladies Night",
      image: "/images/bar.jpg"
    }, {
      id: "b8c9d0e1-f2a3-4456-b789-012345678901",
      title: "Happy Hour",
      image: "/images/bar.jpg"
    }, {
      id: "c9d0e1f2-a3b4-4567-c890-123456789012",
      title: "Student Night",
      image: "/images/bar.jpg"
    }]
  },
  dlirio: {
    name: "DLirio",
    images: [dlirioGallery1, dlirioGallery2, dlirioGallery3, dlirioGallery4],
    video: dlirioVideo,
    ageRestriction: "+21",
    schedule: "22:00–05:00",
    genre: "Electrónica",
    entryPrice: "70.000 Gs",
    tickets: [{
      id: "free-pass-dlirio",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 70000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 200000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 280000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial", "Ubicación privilegiada"]
    }, {
      id: "premium",
      name: "Mesa Premium",
      capacity: 8,
      price: 380000,
      drinks: ["Botella ultra premium", "10 mixers", "Hielera y vasos", "Servicio VIP", "Vista panorámica"]
    }, {
      id: "sofa",
      name: "Sofá Área Preferencial",
      capacity: 10,
      price: 480000,
      drinks: ["2 botellas premium", "15 mixers", "Servicio completo", "Área exclusiva", "Acceso directo"]
    }],
    promotions: [{
      id: 1,
      title: "Bailongo - Sole Rössner",
      image: bailongoPromo
    }, {
      id: 2,
      title: "Tragos Fresh",
      image: tragosFreshPromo
    }, {
      id: 3,
      title: "La Fórmula Perfecta",
      image: formulaPromo
    }]
  },
  fresa: {
    name: "Fresa",
    images: ["/images/bar.jpg", "/images/bar.jpg"],
    video: undefined,
    ageRestriction: "+18",
    schedule: "23:00–06:00",
    genre: "Pop",
    entryPrice: "50.000 Gs",
    tickets: [{
      id: "free-pass-fresa",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 50000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 150000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 250000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial"]
    }],
    promotions: []
  },
  mambo: {
    name: "Mambo",
    images: ["/images/bar.jpg", "/images/bar.jpg"],
    video: undefined,
    ageRestriction: "+18",
    schedule: "23:00–06:00",
    genre: "Reggaeton",
    entryPrice: "45.000 Gs",
    tickets: [{
      id: "free-pass-mambo",
      name: "Free Pass",
      price: 0,
      description: "Entrada gratuita promocional",
      benefits: ["Acceso completo", "Válido para una persona"]
    }, {
      id: "general",
      name: "Entrada General",
      description: "Acceso a todas las áreas del club",
      price: 45000,
      benefits: ["Acceso a pista de baile", "Acceso a barra"]
    }],
    tables: [{
      id: "regular",
      name: "Mesa Regular",
      capacity: 4,
      price: 140000,
      drinks: ["Botella de fernet", "6 mixers", "Hielera y vasos", "Servicio de mesero"]
    }, {
      id: "preferencial",
      name: "Mesa Preferencial",
      capacity: 6,
      price: 240000,
      drinks: ["Botella premium", "8 mixers", "Hielera y vasos", "Servicio preferencial"]
    }],
    promotions: []
  }
};
