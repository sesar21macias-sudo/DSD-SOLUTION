import { redirect } from "next/navigation";

export default async function MinistryIndexPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  redirect(`/ministerios/${slug}/agente`);
}
