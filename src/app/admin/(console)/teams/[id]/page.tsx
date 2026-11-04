import { TeamDetail } from "@/components/admin/TeamDetail";

export default async function TeamPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <TeamDetail id={id} />;
}
