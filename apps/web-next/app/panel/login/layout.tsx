/**
 * Layout específico para /panel/login: NO muestra sidebar ni shell.
 * Renderiza la página de login directamente.
 */
export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
