import { notFound } from "next/navigation";
import { getMinistryBySlug } from "@/lib/ministryFolders";
import { EventList } from "@/components/dashboard/calendario/EventList";

export default async function CalendarioPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ministry = getMinistryBySlug(slug);
  if (!ministry) notFound();

  return <EventList ministrySlug={ministry.slug} />;
}
