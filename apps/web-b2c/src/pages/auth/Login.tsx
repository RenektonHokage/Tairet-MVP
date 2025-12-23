import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Eye, EyeOff, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/components/ui/use-toast";
import { useAuth } from "@/context/AuthContext";

export default function Login() {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [isOwnerLogin, setIsOwnerLogin] = useState(false);
  const { toast } = useToast();
  const navigate = useNavigate();
  const { isAuthenticated, login } = useAuth();

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      const redirectPath = localStorage.getItem("post-login-redirect") || (isOwnerLogin ? "/owner/panel" : "/reservas");
      localStorage.removeItem("post-login-redirect");
      navigate(redirectPath);
    }
  }, [isAuthenticated, navigate, isOwnerLogin]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);

    // Simulate login process
    setTimeout(() => {
      login(isOwnerLogin); // Call the login function from AuthContext with owner flag
      toast({
        title: "¡Bienvenido de vuelta!",
        description: `Has iniciado sesión correctamente${isOwnerLogin ? ' como dueño de local' : ''}.`,
      });
      setIsLoading(false);
      
      // Get redirect path from localStorage or default based on user type
      const defaultPath = isOwnerLogin ? "/owner/panel" : "/reservas";
      const redirectPath = localStorage.getItem("post-login-redirect") || defaultPath;
      localStorage.removeItem("post-login-redirect");
      navigate(redirectPath);
    }, 1500);
  };

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <div className="w-full max-w-md space-y-8">
        {/* Back button */}
        <div className="flex items-center">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/" className="flex items-center gap-2">
              <ArrowLeft className="w-4 h-4" />
              Volver al inicio
            </Link>
          </Button>
        </div>

        {/* Login Card */}
        <Card>
          <CardHeader className="space-y-1">
            <CardTitle className="text-2xl font-bold text-center">Iniciar sesión</CardTitle>
            <CardDescription className="text-center">
              {isOwnerLogin 
                ? "Panel de dueño de local - Ingresa tus credenciales" 
                : "Ingresa tu email y contraseña para acceder a tu cuenta"}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* User Type Toggle */}
            <div className="flex items-center justify-center gap-2 p-1 bg-muted rounded-lg">
              <Button
                type="button"
                variant={!isOwnerLogin ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsOwnerLogin(false)}
                className="flex-1"
              >
                Usuario
              </Button>
              <Button
                type="button"
                variant={isOwnerLogin ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setIsOwnerLogin(true)}
                className="flex-1"
              >
                Soy dueño de local
              </Button>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  placeholder="tu@email.com"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              
              <div className="space-y-2">
                <Label htmlFor="password">Contraseña</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? "text" : "password"}
                    placeholder="Tu contraseña"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    required
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="absolute right-0 top-0 h-full px-3 py-2 hover:bg-transparent"
                    onClick={() => setShowPassword(!showPassword)}
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </Button>
                </div>
              </div>

              <div className="flex items-center justify-between">
                <Button variant="link" className="px-0 text-sm">
                  ¿Olvidaste tu contraseña?
                </Button>
              </div>

              <Button type="submit" className="w-full" disabled={isLoading}>
                {isLoading ? "Iniciando sesión..." : "Iniciar sesión"}
              </Button>
            </form>

            <Separator />

            <div className="space-y-4">
              <Button variant="outline" className="w-full">
                Continuar con Google
              </Button>
              <Button variant="outline" className="w-full">
                Continuar con Facebook
              </Button>
            </div>

            <div className="text-center text-sm">
              ¿No tienes una cuenta?{" "}
              <Button variant="link" className="px-0">
                Regístrate aquí
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}