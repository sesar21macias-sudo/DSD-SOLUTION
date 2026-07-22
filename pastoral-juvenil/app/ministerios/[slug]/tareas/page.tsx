import { notFound } from "next/navigation";
import { getMinistryBySlug } from "@/lib/ministryFolders";
import { TaskList } from "@/components/dashboard/tareas/TaskList";

export default async function TareasPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const ministry = getMinistryBySlug(slug);
  if (!ministry) notFound();

  return <TaskList ministrySlug={ministry.slug} />;
}
