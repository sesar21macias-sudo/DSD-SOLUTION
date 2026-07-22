import { notFound } from "next/navigation";
import { getMinistryBySlug } from "@/lib/ministryFolders";
import { ChatWindow } from "@/components/dashboard/agente/ChatWindow";

export default async function AgentePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ministry = getMinistryBySlug(slug);
  if (!ministry) notFound();

  return <ChatWindow ministryName={ministry.nombre} ministrySlug={ministry.slug} />;
}
