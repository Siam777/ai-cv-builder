"use client";

import { Lock } from "lucide-react";
import { lockedCopy, type PlanGatedFeature } from "@/lib/ai-access";

/** Shown in place of a feature the current plan does not include. */
export function LockedFeature({
  feature,
  onSeePlans,
}: {
  feature: PlanGatedFeature;
  onSeePlans?: () => void;
}) {
  const copy = lockedCopy(feature);
  return (
    <div className="locked-feature" role="group" aria-label={`Locked: ${copy.title}`}>
      <Lock size={18} aria-hidden />
      <div>
        <strong>{copy.title}</strong>
        <p>{copy.reason}</p>
      </div>
      {onSeePlans && (
        <button type="button" className="primary" onClick={onSeePlans}>
          See plans
        </button>
      )}
    </div>
  );
}
