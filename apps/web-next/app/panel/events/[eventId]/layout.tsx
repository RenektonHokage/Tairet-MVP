import { EventPanelShell } from "@/components/panel/EventPanelShell";

interface EventPanelLayoutProps {
  children: React.ReactNode;
  params: Promise<{
    eventId: string;
  }>;
}

export default async function EventPanelLayout({
  children,
  params,
}: EventPanelLayoutProps) {
  const { eventId } = await params;

  return <EventPanelShell eventId={eventId.trim()}>{children}</EventPanelShell>;
}
