import { EventActivitySection } from "@/components/panel/EventActivitySection";

interface EventActivityPageProps {
  params: Promise<{
    eventId: string;
  }>;
}

export default async function EventActivityPage({
  params,
}: EventActivityPageProps) {
  const { eventId } = await params;
  const normalizedEventId = eventId.trim();

  return <EventActivitySection eventId={normalizedEventId} />;
}
