import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getActiveCommitments } from "@/lib/commitments";
import type { CommitmentDTO } from "@/lib/types";
import type { CommitmentType, Currency, Cycle, RenewalMode } from "@/lib/constants";
import { Dashboard } from "@/components/dashboard";

export default async function HomePage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/login");
  }

  const commitments = await getActiveCommitments(session.user.id);

  // Map Prisma rows to a serializable DTO for the client tree.
  const dto: CommitmentDTO[] = commitments.map((c) => ({
    id: c.id,
    name: c.name,
    type: c.type as CommitmentType,
    amountMinor: c.amountMinor,
    currency: c.currency as Currency,
    cycle: c.cycle as Cycle,
    nextDueDate: c.nextDueDate.toISOString(),
    renewalMode: c.renewalMode as RenewalMode,
    notes: c.notes,
  }));

  return <Dashboard commitments={dto} />;
}
