import { notFound } from "next/navigation";
import Link from "next/link";
import { Eye } from "lucide-react";
import { getClientDetail } from "@/lib/data/client-detail";
import { getSql } from "@/lib/db";
import { requireRole } from "@/lib/auth";
import { StaffClientWorkspace } from "@/components/staff-client-workspace";
import { AdminClientSettings } from "./admin-client-settings";
import { InviteClientButton } from "./invite-client-button";

export default async function AdminClientDetailPage({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ call?: string; drive?: string; status?: string;section?:string }>;
}) {
  await requireRole(["admin"]);
  const { id } = await params;
  const { call, drive, status,section } = await searchParams;

  const client = await getClientDetail(id);
  if (!client) notFound();
  const [intake] = client.email ? [] : await getSql()`
    select onboarding_email from public.clients where id = ${id}::uuid
  `;
  const invitationEmail = client.email ?? (intake?.onboarding_email as string | null | undefined) ?? null;

  return (
    <StaffClientWorkspace
      section={section}
      client={client}
      selectedCallId={call}
      callHrefBase={`/admin/clients/${id}`}
      backHref="/admin/clients"
      headerActions={
        <div className="flex flex-wrap items-center gap-2">
          <InviteClientButton clientId={id} email={invitationEmail} name={client.full_name || invitationEmail} linked={!!client.profile_id} />
          <Link href={`/preview/clients/${id}${call ? `?call=${encodeURIComponent(call)}` : ''}`} className="inline-flex min-h-11 items-center gap-2 rounded-md border border-border bg-surface px-3 text-sm font-medium text-foreground hover:bg-surface-muted focus-visible:outline-2 focus-visible:outline-accent">
            <Eye size={16} aria-hidden="true" />Vista previa como cliente
          </Link>
          <AdminClientSettings client={client} driveStatus={drive} clientStatus={status} />
        </div>
      }
      showNotes
    />
  );
}
