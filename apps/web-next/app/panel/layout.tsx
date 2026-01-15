/**
 * Layout raíz de /panel/*.
 * Provee estructura base. El PanelProvider y PanelShell se aplican
 * solo en las rutas que lo necesitan (no en /panel/login).
 */
export default function PanelLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <>{children}</>;
}
