import type { DatasetProfile } from "./dataset-profile";

// Interpret explicit clarification responses only; never reject a user's question.
export function clarificationColumns(text: string, profile: DatasetProfile | null): string[] {
  if (!profile || !/(?:quelle[s]? colonne|which column|précis(?:er|ez)|clarif|ambigu|pas sûr de comprendre|not sure)/i.test(text)) return [];
  const mentioned = profile.sampleHeader.filter((name) => text.toLocaleLowerCase().includes(name.toLocaleLowerCase()));
  return mentioned.length > 0 ? mentioned : profile.sampleHeader;
}

export function emptyReferencedColumn(question: string, profile: DatasetProfile | null): string | null {
  if (!profile) return null;
  return profile.columnProfiles.find((column) => column.nonNull === 0 && column.nulls > 0 && question.toLocaleLowerCase().includes(column.name.toLocaleLowerCase()))?.name ?? null;
}

export function analysisStep(phase: string, streaming: boolean): number {
  return phase === "charts" ? 2 : streaming ? 1 : 0;
}

export function dashboardKey(userId: string): string {
  return `datello:dashboards:${userId}`;
}

export function readDashboardIds(userId: string): string[] {
  try {
    const parsed: unknown = JSON.parse(localStorage.getItem(dashboardKey(userId)) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((id): id is string => typeof id === "string") : [];
  } catch { return []; }
}

export function saveDashboardId(userId: string, threadId: string): void {
  localStorage.setItem(dashboardKey(userId), JSON.stringify([...new Set([...readDashboardIds(userId), threadId])]));
}