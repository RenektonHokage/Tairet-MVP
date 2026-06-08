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

  return (
    <main className="min-h-screen bg-gray-50">
      <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
        <EventActivitySection eventId={normalizedEventId} />
      </div>
    </main>
  );
}
