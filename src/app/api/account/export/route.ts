import { handle, json } from "@/lib/server/http";
import { authorized } from "@/lib/server/auth";
import { listResumes, receipts } from "@/lib/server/resumes";
import { database } from "@/lib/server/database";
import { exportJobReviews } from "@/lib/server/job-review-history";
export const dynamic = "force-dynamic";
export async function GET(request: Request) {
  return handle(async () => {
    const { user } = await authorized(request);
    const tx = await database().client.transaction("read");
    try {
      const resumes = await listResumes(user.id, tx);
      const imports = await receipts(user.id, tx);
      const jobReviews = await exportJobReviews(user.id, tx);
      const aiRequests = (
        await tx.execute({
          sql: "SELECT id,resume_id,base_revision,status,proposal,evidence_snapshot,prompt_version,model,result_revision,created_at,expires_at FROM ai_requests WHERE owner_id=?",
          args: [user.id],
        })
      ).rows.map((row) => ({
        ...row,
        proposal: row.proposal ? JSON.parse(String(row.proposal)) : null,
        evidence_snapshot: row.evidence_snapshot
          ? JSON.parse(String(row.evidence_snapshot))
          : null,
      }));
      const aiUsage = (
        await tx.execute({
          sql: "SELECT day,count FROM ai_owner_usage WHERE owner_id=?",
          args: [user.id],
        })
      ).rows;
      const aiSettings =
        (
          await tx.execute({
            sql: "SELECT enabled,consented_at,updated_at FROM ai_settings WHERE owner_id=?",
            args: [user.id],
          })
        ).rows[0] ?? null;
      const aiInterviews = (
        await tx.execute({
          sql: "SELECT id,resume_id,created_at FROM ai_interviews WHERE owner_id=?",
          args: [user.id],
        })
      ).rows;
      await tx.commit();
      return json({
        format: "cv-builder-account-export",
        schemaVersion: 1,
        exportedAt: new Date().toISOString(),
        account: { id: user.id, email: user.email, createdAt: user.createdAt },
        resumes,
        imports,
        aiRequests,
        aiUsage,
        aiSettings,
        aiInterviews,
        jobReviews,
      });
    } finally {
      tx.close();
    }
  });
}
