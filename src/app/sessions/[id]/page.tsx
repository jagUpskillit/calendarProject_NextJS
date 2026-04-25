import { SessionDetailsClient } from "@/components/sessions/SessionDetailsClient";

interface Props {
  params: Promise<{ id: string }>;
}

export default async function SessionDetailsPage({ params }: Props) {
  const { id } = await params;
  return <SessionDetailsClient id={id} />;
}
