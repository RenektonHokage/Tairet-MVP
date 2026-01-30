import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import * as z from 'zod';
import { createReservation } from '@/lib/api';
import { getLocalBySlug } from '@/lib/locals';
import { Calendar as CalendarIcon, Users, Clock, User, Mail, Phone, FileText } from 'lucide-react';
import { format } from 'date-fns';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import { toast } from 'sonner';
import Navbar from '@/components/layout/Navbar';
import BackButton from '@/components/shared/BackButton';

const reservationSchema = z.object({
  firstName: z.string().trim().min(2, { message: "El nombre debe tener al menos 2 caracteres" }).max(100),
  lastName: z.string().trim().min(2, { message: "El apellido debe tener al menos 2 caracteres" }).max(100),
  email: z.string().trim().email({ message: "Correo electrónico inválido" }).max(255),
  phone: z.string().trim().min(8, { message: "Número de teléfono inválido" }).max(20),
  people: z.string().min(1, { message: "Selecciona la cantidad de personas" }),
  date: z.date({ required_error: "Selecciona una fecha" }),
  time: z.string().min(1, { message: "Selecciona un horario" }),
  comments: z.string().max(200).optional(),
});

const ReservaForm = () => {
  const navigate = useNavigate();
  const { barId } = useParams();
  const [loading, setLoading] = useState(false);
  const [localId, setLocalId] = useState<string | null>(null);

  // Resolver local_id real desde slug
  useEffect(() => {
    if (!barId) return;

    getLocalBySlug(barId)
      .then((local) => {
        if (local) {
          setLocalId(local.id);
        } else {
          console.warn(`No se encontró local con slug: ${barId}`);
        }
      })
      .catch((error) => {
        console.error("Error al obtener local por slug:", error);
      });
  }, [barId]);

  const form = useForm<z.infer<typeof reservationSchema>>({
    resolver: zodResolver(reservationSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      people: "",
      time: "",
      comments: "",
    }
  });

  const onSubmit = async (data: z.infer<typeof reservationSchema>) => {
    if (loading) return;

    if (!localId) {
      toast.error("No se pudo identificar el local. Por favor, recarga la página.");
      return;
    }

    const name = data.firstName.trim();
    const last_name = data.lastName.trim();
    const email = data.email.trim();
    const phone = data.phone.trim();
    const guests = Number(data.people);
    const notes = data.comments?.trim() || undefined;

    // Combinar fecha y hora en ISO-8601
    const dateISO = (() => {
      if (!data.date || !data.time) return "";
      const d = new Date(data.date);
      const [hours, minutes] = data.time.split(":");
      d.setHours(Number(hours), Number(minutes), 0, 0);
      return d.toISOString();
    })();

    try {
      setLoading(true);
      await createReservation({
        local_id: localId,
        name,
        last_name,
        email,
        phone,
        date: dateISO,
        guests,
        notes,
      });
      toast.success("¡Reserva solicitada con éxito! Te contactaremos pronto.");
      form.reset();
      setTimeout(() => {
        navigate(-1);
      }, 1500);
    } catch (err: any) {
      const errorMessage = err?.message || "No se pudo crear la reserva";
      toast.error(errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const timeSlots = [
    "18:00", "18:30", "19:00", "19:30", "20:00", "20:30",
    "21:00", "21:30", "22:00", "22:30", "23:00", "23:30",
    "00:00", "00:30", "01:00", "01:30", "02:00"
  ];

  const peopleOptions = Array.from({ length: 15 }, (_, i) => (i + 1).toString());

  return (
    <div className="min-h-screen bg-background">
      <Navbar />
      
      <div className="container mx-auto px-4 py-8 mt-4 pb-10">
        <BackButton label="Volver al local" fallbackTo="/explorar" className="mb-6" />

        <Card className="max-w-4xl mx-auto overflow-hidden border shadow-lg bg-card">
          <CardHeader className="p-8 border-b">
            <CardTitle className="text-3xl md:text-4xl font-bold text-foreground mb-2">
              Solicitud de reserva
            </CardTitle>
            <p className="text-muted-foreground text-lg">Completa el formulario para reservar tu mesa</p>
          </CardHeader>

          <CardContent className="p-6 md:p-8">
            <Form {...form}>
              <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
                {/* Nombre y Apellido */}
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <FormField
                    control={form.control}
                    name="firstName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-base font-semibold">
                          <User className="w-4 h-4 text-primary" />
                          Nombre
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Tu nombre" {...field} className="h-12 text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="lastName"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-base font-semibold">
                          <User className="w-4 h-4 text-primary" />
                          Apellido
                        </FormLabel>
                        <FormControl>
                          <Input placeholder="Tu apellido" {...field} className="h-12 text-base" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Email */}
                <FormField
                  control={form.control}
                  name="email"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-base font-semibold">
                        <Mail className="w-4 h-4 text-primary" />
                        Email
                      </FormLabel>
                      <FormControl>
                        <Input type="email" placeholder="tu@email.com" {...field} className="h-12 text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Teléfono */}
                <FormField
                  control={form.control}
                  name="phone"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-base font-semibold">
                        <Phone className="w-4 h-4 text-primary" />
                        Nro. de teléfono
                      </FormLabel>
                      <FormControl>
                        <Input placeholder="+595 981 234567" {...field} className="h-12 text-base" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Personas, Fecha y Hora */}
                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                  <FormField
                    control={form.control}
                    name="people"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-base font-semibold">
                          <Users className="w-4 h-4 text-primary" />
                          Personas
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue placeholder="Cantidad" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {peopleOptions.map((num) => (
                              <SelectItem key={num} value={num} className="text-base">
                                {num} {num === "1" ? "persona" : "personas"}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-base font-semibold">
                          <CalendarIcon className="w-4 h-4 text-primary" />
                          Fecha
                        </FormLabel>
                        <Popover>
                          <PopoverTrigger asChild>
                            <FormControl>
                              <Button
                                variant="outline"
                                className={cn(
                                  "h-12 text-base justify-start text-left font-normal",
                                  !field.value && "text-muted-foreground"
                                )}
                              >
                                <CalendarIcon className="mr-2 h-4 w-4" />
                                {field.value ? format(field.value, "dd/MM/yyyy") : <span>Seleccionar</span>}
                              </Button>
                            </FormControl>
                          </PopoverTrigger>
                          <PopoverContent className="w-auto p-0" align="start">
                            <Calendar
                              mode="single"
                              selected={field.value}
                              onSelect={field.onChange}
                              disabled={(date) => date < new Date()}
                              initialFocus
                              className="pointer-events-auto"
                            />
                          </PopoverContent>
                        </Popover>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="time"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="flex items-center gap-2 text-base font-semibold">
                          <Clock className="w-4 h-4 text-primary" />
                          Hora
                        </FormLabel>
                        <Select onValueChange={field.onChange} value={field.value}>
                          <FormControl>
                            <SelectTrigger className="h-12 text-base">
                              <SelectValue placeholder="Horario" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            {timeSlots.map((slot) => (
                              <SelectItem key={slot} value={slot} className="text-base">
                                {slot}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                {/* Comentarios */}
                <FormField
                  control={form.control}
                  name="comments"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="flex items-center gap-2 text-base font-semibold">
                        <FileText className="w-4 h-4 text-primary" />
                        Comentario para el local
                      </FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="Algún comentario o solicitud especial..."
                          className="resize-none text-base"
                          rows={4}
                          maxLength={200}
                          {...field}
                        />
                      </FormControl>
                      <div className="flex justify-end">
                        <span className="text-xs text-muted-foreground">
                          {field.value?.length ?? 0}/200
                        </span>
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {/* Botones */}
                <div className="flex flex-col sm:flex-row gap-4 pt-4">
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => navigate(-1)}
                    className="flex-1 h-12 text-base"
                  >
                    Cancelar
                  </Button>
                  <Button
                    type="submit"
                    className="flex-1 h-12 text-base"
                  >
                    Solicitar reserva
                  </Button>
                </div>
              </form>
            </Form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
};

export default ReservaForm;
