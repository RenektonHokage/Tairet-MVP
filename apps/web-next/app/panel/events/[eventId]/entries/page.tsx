import { EventEntriesSection } from "@/components/panel/EventEntriesSection";

interface EventEntriesPageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function EventEntriesPage({ params }: EventEntriesPageProps) {
  const { eventId } = await params;
  const normalizedEventId = eventId.trim();

  return <EventEntriesSection eventId={normalizedEventId} />;
}
