import { NotebookSource, Workspace } from '../types';

// 2 weeks (14 days) in milliseconds
export const SOURCE_INACTIVITY_TTL_MS = 14 * 24 * 60 * 60 * 1000;

// Throttle passive interaction touches so repeated clicks within 1 minute avoid extra Firestore writes
export const SOURCE_TOUCH_DEBOUNCE_MS = 60 * 1000;

export const EXPIRED_SOURCE_EXCERPT =
  'Source data cleared after 14+ days without interaction. Click to reupload.';

export const MANUAL_DELETED_SOURCE_EXCERPT =
  'Source deleted to free storage. Click to reupload.';

export interface RemovedExpiredSourceInfo {
  workspaceId: string;
  workspaceName: string;
  sourceId: string;
  sourceTitle: string;
  inactiveDays: number;
}

export function getSourceLastInteractedAt(source: NotebookSource, fallbackNow: number = Date.now()): number {
  if (
    typeof source.lastInteractedAt === 'number' &&
    Number.isFinite(source.lastInteractedAt) &&
    source.lastInteractedAt > 0
  ) {
    return source.lastInteractedAt;
  }
  return fallbackNow;
}

export function isSourceExpired(source: NotebookSource, now: number = Date.now()): boolean {
  if (source.isExpired) return true;
  if (
    typeof source.lastInteractedAt !== 'number' ||
    !Number.isFinite(source.lastInteractedAt) ||
    source.lastInteractedAt <= 0
  ) {
    return false;
  }
  return now - source.lastInteractedAt > SOURCE_INACTIVITY_TTL_MS;
}

export function getSourceRemainingMs(source: NotebookSource, now: number = Date.now()): number {
  if (source.isExpired) return 0;
  const lastAt = getSourceLastInteractedAt(source, now);
  const elapsed = Math.max(0, now - lastAt);
  return Math.max(0, SOURCE_INACTIVITY_TTL_MS - elapsed);
}

export function formatSourceExpiryBadge(
  source: NotebookSource,
  now: number = Date.now()
): {
  label: string;
  urgency: 'normal' | 'warning' | 'critical';
  tooltip: string;
} {
  if (source.isExpired) {
    const expiredDate = source.expiredAt
      ? new Date(source.expiredAt).toLocaleDateString([], {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        })
      : 'earlier';
    const isManual = source.expiredReason === 'manual';
    return {
      label: 'Reupload',
      urgency: 'critical',
      tooltip: isManual
        ? `Deleted (${expiredDate}) to save storage. Click this card to reupload.`
        : `Stored data cleared (${expiredDate}) due to >14 days without interaction. Click this card to reupload.`,
    };
  }

  const remainingMs = getSourceRemainingMs(source, now);
  const totalHours = Math.ceil(remainingMs / (60 * 60 * 1000));
  const totalDays = Math.ceil(remainingMs / (24 * 60 * 60 * 1000));

  let label: string;
  let urgency: 'normal' | 'warning' | 'critical' = 'normal';

  if (remainingMs <= 0) {
    label = 'Expiring';
    urgency = 'critical';
  } else if (totalHours < 24) {
    label = `${Math.max(1, totalHours)}h left`;
    urgency = 'critical';
  } else if (totalDays <= 3) {
    label = `${totalDays}d left`;
    urgency = 'warning';
  } else {
    label = `${Math.min(14, totalDays)}d left`;
    urgency = 'normal';
  }

  const lastDate = new Date(getSourceLastInteractedAt(source, now)).toLocaleDateString([], {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  });

  return {
    label,
    urgency,
    tooltip: `Auto-clears stored data after 14 days without interaction (last active: ${lastDate}). Click, toggle, or chat to reset.`,
  };
}

/**
 * Normalizes legacy sources missing `lastInteractedAt` and archives any NotebookLM
 * sources inactive for > 2 weeks (14 days) by clearing heavy payload (`dataUrl` & `fullContent`)
 * while keeping the source card listed with `isExpired: true` so the user can click to reupload.
 */
export function pruneExpiredWorkspaceSources(
  workspaces: Workspace[],
  now: number = Date.now()
): {
  workspaces: Workspace[];
  changed: boolean;
  normalized: boolean;
  removed: RemovedExpiredSourceInfo[];
} {
  let changed = false;
  let normalized = false;
  const removed: RemovedExpiredSourceInfo[] = [];

  const nextWorkspaces = workspaces.map((ws) => {
    if (!Array.isArray(ws.sources) || ws.sources.length === 0) return ws;

    let wsChanged = false;
    let wsExpiredAny = false;

    const nextSources: NotebookSource[] = ws.sources.map((src) => {
      if (src.isExpired) {
        return src;
      }

      if (
        typeof src.lastInteractedAt !== 'number' ||
        !Number.isFinite(src.lastInteractedAt) ||
        src.lastInteractedAt <= 0
      ) {
        normalized = true;
        wsChanged = true;
        return {
          ...src,
          lastInteractedAt: now,
        };
      }

      const elapsed = now - src.lastInteractedAt;
      if (elapsed > SOURCE_INACTIVITY_TTL_MS) {
        changed = true;
        wsChanged = true;
        wsExpiredAny = true;
        removed.push({
          workspaceId: ws.id,
          workspaceName: ws.name,
          sourceId: src.id,
          sourceTitle: src.title,
          inactiveDays: Math.floor(elapsed / (24 * 60 * 60 * 1000)),
        });

        return {
          ...src,
          isExpired: true,
          expiredAt: now,
          expiredReason: 'inactivity',
          selected: false,
          dataUrl: undefined,
          fullContent: '',
          excerpt: EXPIRED_SOURCE_EXCERPT,
        };
      }

      return src;
    });

    if (!wsChanged) return ws;
    return {
      ...ws,
      sources: nextSources,
      updatedAt: wsExpiredAny ? 'Just now' : ws.updatedAt,
    };
  });

  return {
    workspaces: changed || normalized ? nextWorkspaces : workspaces,
    changed,
    normalized,
    removed,
  };
}
