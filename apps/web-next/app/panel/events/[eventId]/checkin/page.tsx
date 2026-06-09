import { EventCheckinSection } from "@/components/panel/EventCheckinSection";

interface EventCheckinPageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function EventCheckinPage({ params }: EventCheckinPageProps) {
  const { eventId } = await params;
  const normalizedEventId = eventId.trim();

  return <EventCheckinSection eventId={normalizedEventId} />;
}
