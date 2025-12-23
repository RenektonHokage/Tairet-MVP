import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowLeft, Upload, Plus, Image as ImageIcon, Layers, CalendarRange, Percent, Sparkles, Music, Clock, MapPin, Users, Star, Trash2, Edit3, CheckCircle, Wine, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";

const WizardSolicitud = () => {
  const [selectedType, setSelectedType] = useState("");
  const [currentStep, setCurrentStep] = useState("validation");
  const [tables, setTables] = useState([
    { id: 1, name: "Mesa Regular", capacity: "4 personas", price: "150.000 Gs" },
    { id: 2, name: "Mesa VIP", capacity: "6 personas", price: "250.000 Gs" },
    { id: 3, name: "Mesa Premium", capacity: "8 personas", price: "350.000 Gs" }
  ]);
  const [promotions, setPromotions] = useState({
    bar: ["Happy Hour", "2x1 Cervezas", "Noches de Cocktail"],
    club: ["Ladies Night", "Happy Hour", "Student Night"]
  });
  const [promotionTemplates, setPromotionTemplates] = useState({
    bar: [
      { id: 1, name: "Happy Hour", image: "/images/bar.jpg", active: true },
      { id: 2, name: "2x1 Cervezas", image: "/images/bar.jpg", active: true },
      { id: 3, name: "Noches de Cocktail", image: "/images/bar.jpg", active: true },
      { id: 4, name: "Karaoke Night", image: "/images/bar.jpg", active: false },
      { id: 5, name: "Descuento Estudiantes", image: "/images/bar.jpg", active: false }
    ],
    club: [
      { id: 1, name: "Ladies Night", image: "/images/bar.jpg", active: true },
      { id: 2, name: "Happy Hour", image: "/images/bar.jpg", active: true },
      { id: 3, name: "Student Night", image: "/images/bar.jpg", active: true },
      { id: 4, name: "VIP Package", image: "/images/bar.jpg", active: false },
      { id: 5, name: "Early Bird", image: "/images/bar.jpg", active: false }
    ]
  });
  const [newPromotion, setNewPromotion] = useState({ name: "", image: "" });
  const [editingTable, setEditingTable] = useState(null);
  const [newTable, setNewTable] = useState({ 
    name: "", 
    capacity: "", 
    price: "", 
    includes: { drinks: [], entry: false } 
  });

  useEffect(() => {
    document.title = "Solicitud de socio | Tairet";
    const desc = "Completá la solicitud para publicar tu local en Tairet.";
    let meta = document.querySelector('meta[name="description"]');
    if (!meta) {
      meta = document.createElement("meta");
      meta.setAttribute("name", "description");
      document.head.appendChild(meta);
    }
    meta.setAttribute("content", desc);
  }, []);

  return (
    <div className="min-h-screen bg-background text-foreground">
      <header className="sticky top-0 z-40 border-b bg-background/80 backdrop-blur">
        <div className="mx-auto max-w-7xl px-6 py-3 flex items-center justify-between">
          <Button asChild variant="ghost" aria-label="Volver a la landing">
            <Link to="/" className="inline-flex items-center">
              <ArrowLeft aria-hidden className="mr-2" />
              <span>Volver</span>
            </Link>
          </Button>
          <div className="text-sm text-muted-foreground">Solicitud para locales</div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-semibold tracking-tight">Solicitud de publicación</h1>
          <p className="text-sm text-muted-foreground">Completá los pasos para validar tu local y elegir tu categoría.</p>
        </div>

        {/* VALIDACIÓN INICIAL */}
        {currentStep === "validation" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Datos para validación</CardTitle>
              <CardDescription>Ingresá la información básica de tu local para verificación.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-4">
              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label htmlFor="name">Nombre del local</Label>
                  <Input id="name" placeholder="Ej: Club Aurora" />
                </div>
                <div>
                  <Label htmlFor="email">Email de contacto</Label>
                  <Input id="email" type="email" placeholder="contacto@tulocal.com" />
                </div>
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input id="phone" placeholder="Ej: +595 9xx xxx xxx" />
                </div>
                <div>
                  <Label htmlFor="location">Dirección completa</Label>
                  <Input id="location" placeholder="Ej: Palma 123 esq. Chile, Asunción" />
                </div>
              </div>

              <div>
                <Label htmlFor="owner">Nombre del propietario/representante</Label>
                <Input id="owner" placeholder="Nombre completo" />
              </div>

              <div>
                <Label htmlFor="ruc">RUC del local (opcional)</Label>
                <Input id="ruc" placeholder="XXXXXXXX-X" />
              </div>

              <div className="grid gap-2 md:grid-cols-2">
                <div>
                  <Label htmlFor="instagram">Instagram (opcional)</Label>
                  <Input id="instagram" placeholder="https://www.instagram.com/tulocal" />
                </div>
                <div>
                  <Label htmlFor="tiktok">TikTok (opcional)</Label>
                  <Input id="tiktok" placeholder="https://www.tiktok.com/@tulocal" />
                </div>
              </div>

              <div className="pt-4">
                <Button onClick={() => setCurrentStep("selection")} className="w-full">
                  Continuar con selección de categoría
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* SELECCIÓN DE TIPO */}
        {currentStep === "selection" && (
          <Card className="max-w-2xl">
            <CardHeader>
              <CardTitle>Tipo de local</CardTitle>
              <CardDescription>Seleccioná qué tipo de local querés publicar en Tairet.</CardDescription>
            </CardHeader>
            <CardContent className="grid gap-6">
              <RadioGroup value={selectedType} onValueChange={setSelectedType}>
                <div className="grid gap-4">
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="bar" id="bar" />
                    <Label htmlFor="bar" className="flex-1 cursor-pointer">
                      <div className="font-medium">Bar</div>
                      <div className="text-sm text-muted-foreground">Ambiente relajado, cervezas, cocteles, música ambient</div>
                    </Label>
                  </div>
                  
                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="club" id="club" />
                    <Label htmlFor="club" className="flex-1 cursor-pointer">
                      <div className="font-medium">Discoteca/Boliche</div>
                      <div className="text-sm text-muted-foreground">Música alta, pista de baile, mesas VIP, ambiente nocturno</div>
                    </Label>
                  </div>

                  <div className="flex items-center space-x-3 p-4 border rounded-lg hover:bg-muted/50">
                    <RadioGroupItem value="both" id="both" />
                    <Label htmlFor="both" className="flex-1 cursor-pointer">
                      <div className="font-medium">Ambos</div>
                      <div className="text-sm text-muted-foreground">Mi local funciona como bar y discoteca según el horario</div>
                    </Label>
                  </div>
                </div>
              </RadioGroup>

              <div className="flex gap-3 pt-4">
                <Button variant="secondary" onClick={() => setCurrentStep("validation")}>
                  Volver
                </Button>
                <Button 
                  onClick={() => setCurrentStep("setup")} 
                  disabled={!selectedType}
                  className="flex-1"
                >
                  Continuar con configuración
                </Button>
              </div>
            </CardContent>
          </Card>
        )}

        {/* CONFIGURACIÓN ESPECÍFICA */}
        {currentStep === "setup" && selectedType && (
          <>
            {/* BAR SETUP */}
            {(selectedType === "bar" || selectedType === "both") && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Music className="h-5 w-5" />
                    Configuración de Bar
                  </CardTitle>
                  <CardDescription>Configurá la información específica para tu bar.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Galería de fotos */}
                  <div>
                    <Label className="text-sm font-medium">Galería de fotos</Label>
                    <div className="mt-2 grid grid-cols-3 gap-3 md:grid-cols-6">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Subí fotos del ambiente, barra, mesas. La primera imagen puede ser un video si querés.</p>
                  </div>

                  {/* Información básica */}
                  <div className="grid gap-4 md:grid-cols-2">
                    <div>
                      <Label htmlFor="bar-schedule">Horarios</Label>
                      <Input id="bar-schedule" placeholder="Ej: Lun-Sáb 18:00–02:00" />
                    </div>
                    <div>
                      <Label htmlFor="bar-age">Restricción de edad</Label>
                      <Input id="bar-age" placeholder="Ej: +18" />
                    </div>
                  </div>

                  <div>
                    <Label htmlFor="bar-specialties">Especialidades</Label>
                    <Select>
                      <SelectTrigger>
                        <SelectValue placeholder="Seleccionar especialidades" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="cervezas">Cervezas</SelectItem>
                        <SelectItem value="cocteles">Cocteles</SelectItem>
                        <SelectItem value="vinos">Vinos</SelectItem>
                        <SelectItem value="whisky">Whisky</SelectItem>
                        <SelectItem value="tragos-premium">Tragos Premium</SelectItem>
                        <SelectItem value="comida">Comida</SelectItem>
                        <SelectItem value="musica-en-vivo">Música en vivo</SelectItem>
                        <SelectItem value="karaoke">Karaoke</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div>
                    <Label htmlFor="bar-description">Descripción del bar</Label>
                    <Textarea 
                      id="bar-description" 
                      rows={4} 
                      placeholder="Describí el ambiente, música, especialidades, historia del local..."
                    />
                  </div>

                  {/* Promociones */}
                  <div>
                    <Label className="text-sm font-medium">Promociones</Label>
                    
                    {/* Promociones activas */}
                    <div className="mt-4 space-y-4">
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {promotionTemplates.bar.filter(p => p.active).map((promo) => (
                          <div key={promo.id} className="relative">
                            <div className="aspect-[4/3] relative overflow-hidden rounded-lg border">
                              <img 
                                src={promo.image} 
                                alt={promo.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                              <div className="absolute bottom-2 left-2 right-2">
                                <h4 className="text-white font-semibold text-sm">{promo.name}</h4>
                              </div>
                              <Badge 
                                className="absolute top-2 right-2 bg-green-500 hover:bg-green-600"
                              >
                                Activa
                              </Badge>
                              <Button
                                size="sm"
                                className="absolute top-2 left-2 h-6 w-6 p-0"
                                variant="destructive"
                                onClick={() => {
                                  setPromotionTemplates(prev => ({
                                    ...prev,
                                    bar: prev.bar.map(p => p.id === promo.id ? {...p, active: false} : p)
                                  }));
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {promotionTemplates.bar.filter(p => p.active).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          No hay promociones activas
                        </div>
                      )}
                    </div>

                    {/* Promociones disponibles para activar */}
                    {promotionTemplates.bar.filter(p => !p.active).length > 0 && (
                      <div className="mt-6">
                        <Label className="text-sm font-medium text-muted-foreground mb-3 block">Promociones guardadas</Label>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {promotionTemplates.bar.filter(p => !p.active).map((promo) => (
                            <div key={promo.id} className="relative opacity-60 hover:opacity-80 transition-opacity">
                              <div className="aspect-[4/3] relative overflow-hidden rounded-lg border border-dashed">
                                <img 
                                  src={promo.image} 
                                  alt={promo.name}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                <div className="absolute bottom-2 left-2 right-2">
                                  <h4 className="text-white font-semibold text-sm">{promo.name}</h4>
                                </div>
                                <Button
                                  size="sm"
                                  className="absolute top-2 right-2 h-6 w-6 p-0"
                                  onClick={() => {
                                    setPromotionTemplates(prev => ({
                                      ...prev,
                                      bar: prev.bar.map(p => p.id === promo.id ? {...p, active: true} : p)
                                    }));
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Crear nueva promoción */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full mt-4">
                          <Plus className="h-4 w-4 mr-2" /> Crear nueva promoción
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Crear nueva promoción</DialogTitle>
                          <DialogDescription>Creá una promoción personalizada para tu bar</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="promo-name">Nombre de la promoción</Label>
                            <Input 
                              id="promo-name"
                              value={newPromotion.name}
                              onChange={(e) => setNewPromotion(prev => ({...prev, name: e.target.value}))}
                              placeholder="Ej: 2x1 en cervezas artesanales"
                            />
                          </div>
                          <div>
                            <Label htmlFor="promo-image">Imagen (opcional)</Label>
                            <Input 
                              id="promo-image"
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  // En producción se subiría la imagen
                                  setNewPromotion(prev => ({...prev, image: "/images/bar.jpg"}));
                                }
                              }}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            onClick={() => {
                              if (newPromotion.name.trim()) {
                                const newId = Math.max(...promotionTemplates.bar.map(p => p.id)) + 1;
                                setPromotionTemplates(prev => ({
                                  ...prev,
                                  bar: [...prev.bar, {
                                    id: newId,
                                    name: newPromotion.name.trim(),
                                    image: newPromotion.image || "/images/bar.jpg",
                                    active: true
                                  }]
                                }));
                                setNewPromotion({ name: "", image: "" });
                              }
                            }}
                          >
                            Crear promoción
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* CLUB SETUP */}
            {(selectedType === "club" || selectedType === "both") && (
              <Card className="mb-6">
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Sparkles className="h-5 w-5" />
                    Configuración de Discoteca
                  </CardTitle>
                  <CardDescription>Configurá mesas, precios y promociones para tu discoteca.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-6">
                  {/* Galería de fotos */}
                  <div>
                    <Label className="text-sm font-medium">Galería de fotos</Label>
                    <div className="mt-2 grid grid-cols-3 gap-3 md:grid-cols-6">
                      {Array.from({ length: 6 }).map((_, i) => (
                        <div key={i} className="aspect-square rounded-md border border-dashed flex items-center justify-center text-muted-foreground">
                          <ImageIcon className="h-5 w-5" />
                        </div>
                      ))}
                    </div>
                    <p className="text-xs text-muted-foreground mt-1">Subí fotos de la pista, mesas VIP, ambiente nocturno. La primera imagen puede ser un video si querés.</p>
                  </div>

                  {/* Información básica */}
                  <div className="grid gap-4 md:grid-cols-3">
                    <div>
                      <Label htmlFor="club-schedule">Horarios</Label>
                      <Input id="club-schedule" placeholder="Ej: Jue-Sáb 23:00–06:00" />
                    </div>
                    <div>
                      <Label htmlFor="club-genre">Género musical</Label>
                      <Input id="club-genre" placeholder="Ej: Reggaeton, Comercial" />
                    </div>
                    <div>
                      <Label htmlFor="club-entry">Entrada</Label>
                      <Input id="club-entry" placeholder="Ej: 50.000 Gs" />
                    </div>
                  </div>

                  {/* Mesas y precios */}
                  <div>
                    <Label className="text-sm font-medium">Mesas disponibles</Label>
                    <div className="mt-4 space-y-4">
                      {tables.map((table) => (
                        <div key={table.id} className="flex items-center justify-between p-4 border rounded-lg">
                          <div>
                            <div className="font-medium">{table.name}</div>
                            <div className="text-sm text-muted-foreground">Capacidad: {table.capacity}</div>
                          </div>
                          <div className="text-right flex items-center gap-2">
                            <div className="font-medium">{table.price}</div>
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button size="sm" variant="outline" onClick={() => setEditingTable(table)}>
                                  <Edit3 className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar mesa</DialogTitle>
                                  <DialogDescription>Modificá los detalles de la mesa</DialogDescription>
                                </DialogHeader>
                                <div className="grid gap-4 py-4">
                                  <div>
                                    <Label htmlFor="edit-name">Nombre</Label>
                                    <Input 
                                      id="edit-name" 
                                      defaultValue={table.name}
                                      onChange={(e) => setEditingTable(prev => prev ? {...prev, name: e.target.value} : null)}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-capacity">Capacidad</Label>
                                    <Input 
                                      id="edit-capacity" 
                                      defaultValue={table.capacity}
                                      onChange={(e) => setEditingTable(prev => prev ? {...prev, capacity: e.target.value} : null)}
                                    />
                                  </div>
                                  <div>
                                    <Label htmlFor="edit-price">Precio</Label>
                                    <Input 
                                      id="edit-price" 
                                      defaultValue={table.price}
                                      onChange={(e) => setEditingTable(prev => prev ? {...prev, price: e.target.value} : null)}
                                    />
                                  </div>
                                </div>
                                <DialogFooter>
                                  <Button variant="destructive" onClick={() => {
                                    setTables(prev => prev.filter(t => t.id !== table.id));
                                    setEditingTable(null);
                                  }}>
                                    Eliminar
                                  </Button>
                                  <Button onClick={() => {
                                    if (editingTable) {
                                      setTables(prev => prev.map(t => t.id === table.id ? editingTable : t));
                                      setEditingTable(null);
                                    }
                                  }}>
                                    Guardar
                                  </Button>
                                </DialogFooter>
                              </DialogContent>
                            </Dialog>
                          </div>
                        </div>
                      ))}
                      <Dialog>
                        <DialogTrigger asChild>
                          <Button variant="secondary" className="w-full">
                            <Plus className="h-4 w-4 mr-2" /> Agregar mesa
                          </Button>
                        </DialogTrigger>
                        <DialogContent>
                          <DialogHeader>
                            <DialogTitle>Agregar nueva mesa</DialogTitle>
                            <DialogDescription>Configurá los detalles de la nueva mesa</DialogDescription>
                          </DialogHeader>
                          <div className="grid gap-4 py-4">
                            <div>
                              <Label htmlFor="new-name">Nombre</Label>
                              <Input 
                                id="new-name" 
                                value={newTable.name}
                                onChange={(e) => setNewTable(prev => ({...prev, name: e.target.value}))}
                                placeholder="Ej: Mesa VIP Deluxe"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-capacity">Capacidad</Label>
                              <Input 
                                id="new-capacity" 
                                value={newTable.capacity}
                                onChange={(e) => setNewTable(prev => ({...prev, capacity: e.target.value}))}
                                placeholder="Ej: 8 personas"
                              />
                            </div>
                            <div>
                              <Label htmlFor="new-price">Precio</Label>
                              <Input 
                                id="new-price" 
                                value={newTable.price}
                                onChange={(e) => setNewTable(prev => ({...prev, price: e.target.value}))}
                                placeholder="Ej: 400.000 Gs"
                              />
                            </div>
                            <div className="space-y-3">
                              <Label>¿Qué incluye?</Label>
                              <div className="space-y-2">
                                <div className="flex items-center space-x-2">
                                  <Checkbox 
                                    id="includes-entry"
                                    checked={newTable.includes.entry}
                                    onCheckedChange={(checked) => 
                                      setNewTable(prev => ({
                                        ...prev, 
                                        includes: {...prev.includes, entry: !!checked}
                                      }))
                                    }
                                  />
                                  <Label htmlFor="includes-entry" className="text-sm">Entrada incluida</Label>
                                </div>
                                
                                <div>
                                  <Label className="text-sm">Bebidas incluidas:</Label>
                                  <div className="mt-2 space-y-2">
                                    {["Champagne", "Whisky", "Vodka", "Cervezas", "Tragos básicos"].map((drink) => (
                                      <div key={drink} className="flex items-center space-x-2">
                                        <Checkbox 
                                          id={`drink-${drink}`}
                                          checked={newTable.includes.drinks.includes(drink)}
                                          onCheckedChange={(checked) => {
                                            setNewTable(prev => ({
                                              ...prev,
                                              includes: {
                                                ...prev.includes,
                                                drinks: !!checked 
                                                  ? [...prev.includes.drinks, drink]
                                                  : prev.includes.drinks.filter(d => d !== drink)
                                              }
                                            }));
                                          }}
                                        />
                                        <Label htmlFor={`drink-${drink}`} className="text-sm">{drink}</Label>
                                      </div>
                                    ))}
                                  </div>
                                </div>
                              </div>
                            </div>
                          </div>
                          <DialogFooter>
                            <Button onClick={() => {
                              if (newTable.name && newTable.capacity && newTable.price) {
                                setTables(prev => [...prev, {
                                  id: Math.max(...prev.map(t => t.id)) + 1,
                                  ...newTable
                                }]);
                                setNewTable({ 
                                  name: "", 
                                  capacity: "", 
                                  price: "", 
                                  includes: { drinks: [], entry: false } 
                                });
                              }
                            }}>
                              Agregar
                            </Button>
                          </DialogFooter>
                        </DialogContent>
                      </Dialog>
                    </div>
                  </div>

                  {/* Promociones */}
                  <div>
                    <Label className="text-sm font-medium">Promociones</Label>
                    
                    {/* Promociones activas */}
                    <div className="mt-4 space-y-4">
                      <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                        {promotionTemplates.club.filter(p => p.active).map((promo) => (
                          <div key={promo.id} className="relative">
                            <div className="aspect-[4/3] relative overflow-hidden rounded-lg border">
                              <img 
                                src={promo.image} 
                                alt={promo.name}
                                className="w-full h-full object-cover"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                              <div className="absolute bottom-2 left-2 right-2">
                                <h4 className="text-white font-semibold text-sm">{promo.name}</h4>
                              </div>
                              <Badge 
                                className="absolute top-2 right-2 bg-green-500 hover:bg-green-600"
                              >
                                Activa
                              </Badge>
                              <Button
                                size="sm"
                                className="absolute top-2 left-2 h-6 w-6 p-0"
                                variant="destructive"
                                onClick={() => {
                                  setPromotionTemplates(prev => ({
                                    ...prev,
                                    club: prev.club.map(p => p.id === promo.id ? {...p, active: false} : p)
                                  }));
                                }}
                              >
                                <X className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        ))}
                      </div>
                      
                      {promotionTemplates.club.filter(p => p.active).length === 0 && (
                        <div className="text-center py-8 text-muted-foreground border-2 border-dashed rounded-lg">
                          No hay promociones activas
                        </div>
                      )}
                    </div>

                    {/* Promociones disponibles para activar */}
                    {promotionTemplates.club.filter(p => !p.active).length > 0 && (
                      <div className="mt-6">
                        <Label className="text-sm font-medium text-muted-foreground mb-3 block">Promociones guardadas</Label>
                        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
                          {promotionTemplates.club.filter(p => !p.active).map((promo) => (
                            <div key={promo.id} className="relative opacity-60 hover:opacity-80 transition-opacity">
                              <div className="aspect-[4/3] relative overflow-hidden rounded-lg border border-dashed">
                                <img 
                                  src={promo.image} 
                                  alt={promo.name}
                                  className="w-full h-full object-cover"
                                />
                                <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
                                <div className="absolute bottom-2 left-2 right-2">
                                  <h4 className="text-white font-semibold text-sm">{promo.name}</h4>
                                </div>
                                <Button
                                  size="sm"
                                  className="absolute top-2 right-2 h-6 w-6 p-0"
                                  onClick={() => {
                                    setPromotionTemplates(prev => ({
                                      ...prev,
                                      club: prev.club.map(p => p.id === promo.id ? {...p, active: true} : p)
                                    }));
                                  }}
                                >
                                  <Plus className="h-3 w-3" />
                                </Button>
                              </div>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}

                    {/* Crear nueva promoción */}
                    <Dialog>
                      <DialogTrigger asChild>
                        <Button variant="outline" className="w-full mt-4">
                          <Plus className="h-4 w-4 mr-2" /> Crear nueva promoción
                        </Button>
                      </DialogTrigger>
                      <DialogContent>
                        <DialogHeader>
                          <DialogTitle>Crear nueva promoción</DialogTitle>
                          <DialogDescription>Creá una promoción personalizada para tu discoteca</DialogDescription>
                        </DialogHeader>
                        <div className="space-y-4">
                          <div>
                            <Label htmlFor="promo-name-club">Nombre de la promoción</Label>
                            <Input 
                              id="promo-name-club"
                              value={newPromotion.name}
                              onChange={(e) => setNewPromotion(prev => ({...prev, name: e.target.value}))}
                              placeholder="Ej: Entrada gratis para mujeres"
                            />
                          </div>
                          <div>
                            <Label htmlFor="promo-image-club">Imagen (opcional)</Label>
                            <Input 
                              id="promo-image-club"
                              type="file"
                              accept="image/*"
                              onChange={(e) => {
                                const file = e.target.files?.[0];
                                if (file) {
                                  // En producción se subiría la imagen
                                  setNewPromotion(prev => ({...prev, image: "/images/bar.jpg"}));
                                }
                              }}
                            />
                          </div>
                        </div>
                        <DialogFooter>
                          <Button 
                            onClick={() => {
                              if (newPromotion.name.trim()) {
                                const newId = Math.max(...promotionTemplates.club.map(p => p.id)) + 1;
                                setPromotionTemplates(prev => ({
                                  ...prev,
                                  club: [...prev.club, {
                                    id: newId,
                                    name: newPromotion.name.trim(),
                                    image: newPromotion.image || "/images/bar.jpg",
                                    active: true
                                  }]
                                }));
                                setNewPromotion({ name: "", image: "" });
                              }
                            }}
                          >
                            Crear promoción
                          </Button>
                        </DialogFooter>
                      </DialogContent>
                    </Dialog>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* UBICACIÓN Y CONTACTO */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Ubicación y contacto
                </CardTitle>
                <CardDescription>Información para que los clientes te encuentren.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid gap-4 md:grid-cols-2">
                  <div>
                    <Label htmlFor="address">Dirección completa</Label>
                    <Input id="address" placeholder="Av. Mariscal López 1234, Asunción" />
                  </div>
                  <div>
                    <Label htmlFor="phone-contact">Teléfono</Label>
                    <Input id="phone-contact" placeholder="(021) 555-123" />
                  </div>
                </div>

                <div>
                  <Label htmlFor="additional-info">Información adicional</Label>
                  <Textarea 
                    id="additional-info" 
                    rows={3}
                    placeholder="Ej: Estacionamiento disponible, Dress code elegante, Reservas recomendadas..."
                  />
                </div>
              </CardContent>
            </Card>

            {/* PREVISUALIZACIÓN */}
            <Card className="mb-6">
              <CardHeader>
                <CardTitle>Previsualización</CardTitle>
                <CardDescription>Así se verá tu local en Tairet</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="rounded-2xl overflow-hidden bg-card shadow-md max-w-sm mx-auto">
                  {selectedType === "club" || selectedType === "both" ? (
                    <>
                      {/* Header con gradiente estilo club */}
                      <div className="h-40 bg-gradient-to-br from-purple-600 via-pink-500 to-red-500 flex flex-col items-center justify-center text-center">
                        <div className="text-white font-bold text-2xl tracking-wide">Vie, 15</div>
                        <div className="text-white/90 text-sm uppercase tracking-wider">NOV</div>
                      </div>
                      
                      {/* Body */}
                      <div className="p-4">
                        {/* Top row: título + rating */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-bold text-card-foreground">Tu Local</h3>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-semibold text-card-foreground">4.5</span>
                          </div>
                        </div>
                        
                        {/* Schedule line */}
                        <div className="text-sm text-muted-foreground flex items-center mb-3">
                          <Clock className="w-4 h-4 mr-2" />
                          {selectedType === "club" ? "23:00–06:00" : "Horarios variables"}
                        </div>
                        
                        {/* Availability badge */}
                        <div className="mb-3">
                          <span className="inline-flex items-center gap-1 bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            <CheckCircle className="w-3 h-3 text-green-600" />
                            Mesas disponibles
                          </span>
                        </div>
                        
                        {/* Genre chips */}
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
                            <Music className="w-3 h-3" />
                            Reggaeton
                          </span>
                          <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
                            <Music className="w-3 h-3" />
                            Comercial
                          </span>
                          <span className="inline-flex items-center bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
                            +18
                          </span>
                        </div>
                      </div>
                    </>
                  ) : (
                    <>
                      {/* Header con gradiente estilo bar */}
                      <div className="h-40 bg-gradient-to-br from-amber-600 via-orange-500 to-red-500 flex flex-col items-center justify-center text-center">
                        <div className="text-white font-bold text-2xl tracking-wide">Abierto</div>
                        <div className="text-white/90 text-sm uppercase tracking-wider">HOY</div>
                      </div>
                      
                      {/* Body */}
                      <div className="p-4">
                        {/* Top row: título + rating */}
                        <div className="flex items-start justify-between gap-3 mb-2">
                          <h3 className="font-bold text-card-foreground">Tu Local</h3>
                          <div className="flex items-center gap-1">
                            <Star className="w-4 h-4 text-yellow-400 fill-yellow-400" />
                            <span className="text-sm font-semibold text-card-foreground">4.5</span>
                          </div>
                        </div>
                        
                        {/* Schedule line */}
                        <div className="text-sm text-muted-foreground flex items-center mb-2">
                          <Clock className="w-4 h-4 mr-2" />
                          18:00–02:00
                        </div>
                        
                        {/* Location */}
                        <div className="text-sm text-muted-foreground mb-6">
                          Centro • Asunción
                        </div>
                        
                        {/* Specialty chips */}
                        <div className="flex flex-wrap gap-2">
                          <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
                            <Wine className="w-3 h-3" />
                            Cervezas
                          </span>
                          <span className="inline-flex items-center gap-1 bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
                            <Wine className="w-3 h-3" />
                            Cocteles
                          </span>
                          <span className="inline-flex items-center bg-muted text-muted-foreground text-xs px-2 py-1 rounded">
                            +18
                          </span>
                        </div>
                      </div>
                    </>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* TÉRMINOS Y ENVÍO */}
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 mb-4">
                  <Checkbox id="terms" />
                  <Label htmlFor="terms" className="text-sm">
                    Acepto los <Link to="/legal/terminos" className="underline">Términos y condiciones</Link>
                  </Label>
                </div>

                <div className="flex gap-3">
                  <Button variant="secondary" onClick={() => setCurrentStep("selection")}>
                    Volver
                  </Button>
                  <Button className="flex-1">
                    Enviar solicitud
                  </Button>
                </div>
              </CardContent>
            </Card>
          </>
        )}
      </main>
    </div>
  );
};

export default WizardSolicitud;
