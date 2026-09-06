import { api } from "@/lib/api/client";

/**
 * Mentoria — trilhas, aulas e progresso.
 *
 * As interfaces espelham o que `MentorshipService` (backend) devolve. Duração
 * SEMPRE em segundos: quem formata "14:20" ou "6min left" é o front, para que a
 * mesma resposta sirva a formatos diferentes sem uma segunda rota.
 */

/** Nome do token de cor do acento — o hex fica no CSS, não no banco. */
export type MentorshipAccent = "PRINCIPAL" | "GREEN" | "AZUL" | "VIOLETA";

export interface MentorshipLesson {
  id: string;
  title: string;
  description: string;
  episode: number;
  durationSec: number;
  coverUrl: string;
  videoUrl: string;
  moduleId: string;
  moduleTitle: string;
  positionSec: number;
  completed: boolean;
  /** 0–100, decidido no servidor. */
  percent: number;
}

export interface MentorshipModule {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  label: string;
  coverUrl: string;
  accent: MentorshipAccent;
  lessonCount: number;
  totalDurationSec: number;
  completedCount: number;
  percent: number;
  lessons: MentorshipLesson[];
}

export interface MentorshipOverview {
  modules: MentorshipModule[];
  totals: { lessons: number; completed: number; modules: number };
  /** Aula do card "Continue where you left off". `null` = nada pendente. */
  continueLesson: (MentorshipLesson & { remainingSec: number }) | null;
}

/** Chave do React Query — exportada para as mutações invalidarem a mesma. */
export const MENTORSHIP_OVERVIEW_KEY = ["mentorship-overview"] as const;

/** Tudo o que a tela de mentoria mostra, já com o progresso do usuário. */
export async function getMentorshipOverview(): Promise<MentorshipOverview> {
  const { data } = await api.get<MentorshipOverview>(
    "/api/v1/mentorship/overview",
  );
  return data;
}

export interface ProgressResult {
  lessonId: string;
  positionSec: number;
  completed: boolean;
  percent: number;
}

/**
 * Salva onde o usuário parou. O servidor prende a posição à duração real da
 * aula — mandar um número maior não "conclui" nada que não foi assistido.
 */
export async function saveLessonProgress(
  lessonId: string,
  body: { positionSec?: number; completed?: boolean },
): Promise<ProgressResult> {
  const { data } = await api.patch<ProgressResult>(
    `/api/v1/mentorship/lessons/${lessonId}/progress`,
    body,
  );
  return data;
}

// ── Admin ────────────────────────────────────────────────────────────────────

/** Aula como o admin edita — sem o progresso, com os campos de rascunho. */
export interface AdminLesson {
  id: string;
  moduleId: string;
  title: string;
  description: string;
  episode: number;
  durationSec: number;
  coverUrl: string;
  videoUrl: string;
  position: number;
  published: boolean;
}

/** Trilha na LISTA do admin (sem as aulas, com a contagem delas). */
export interface AdminModuleSummary {
  id: string;
  slug: string;
  title: string;
  subtitle: string;
  label: string;
  coverUrl: string;
  accent: MentorshipAccent;
  position: number;
  published: boolean;
  lessonCount: number;
}

/** Trilha ABERTA no editor — com as aulas, inclusive as não publicadas. */
export interface AdminModuleDetail extends Omit<AdminModuleSummary, "lessonCount"> {
  lessons: AdminLesson[];
}

export interface ModulePayload {
  slug: string;
  title: string;
  subtitle: string;
  label: string;
  coverUrl: string;
  accent: MentorshipAccent;
  published: boolean;
}

export interface LessonPayload {
  title: string;
  description: string;
  episode: number;
  durationSec: number;
  coverUrl: string;
  videoUrl: string;
  published: boolean;
}

export const ADMIN_MODULES_KEY = ["mentorship-admin-modules"] as const;

/** Chave da trilha aberta no editor — chave DIFERENTE da listagem. */
export const adminModuleKey = (id: string) =>
  ["mentorship-admin-module", id] as const;

export async function listAdminModules(): Promise<AdminModuleSummary[]> {
  const { data } = await api.get<AdminModuleSummary[]>(
    "/api/v1/mentorship/admin/modules",
  );
  return data;
}

export async function getAdminModule(id: string): Promise<AdminModuleDetail> {
  const { data } = await api.get<AdminModuleDetail>(
    `/api/v1/mentorship/admin/modules/${id}`,
  );
  return data;
}

export async function createModule(
  payload: ModulePayload,
): Promise<AdminModuleSummary> {
  const { data } = await api.post<AdminModuleSummary>(
    "/api/v1/mentorship/admin/modules",
    payload,
  );
  return data;
}

export async function updateModule(
  id: string,
  payload: Partial<ModulePayload>,
): Promise<AdminModuleSummary> {
  const { data } = await api.patch<AdminModuleSummary>(
    `/api/v1/mentorship/admin/modules/${id}`,
    payload,
  );
  return data;
}

export async function deleteModule(id: string): Promise<void> {
  await api.delete(`/api/v1/mentorship/admin/modules/${id}`);
}

/** Nova ordem das trilhas — a posição de cada id vira o índice na lista. */
export async function reorderModules(ids: string[]): Promise<void> {
  await api.patch("/api/v1/mentorship/admin/modules/reorder", { ids });
}

export async function createLesson(
  moduleId: string,
  payload: LessonPayload,
): Promise<AdminLesson> {
  const { data } = await api.post<AdminLesson>(
    `/api/v1/mentorship/admin/modules/${moduleId}/lessons`,
    payload,
  );
  return data;
}

export async function updateLesson(
  id: string,
  payload: Partial<LessonPayload>,
): Promise<AdminLesson> {
  const { data } = await api.patch<AdminLesson>(
    `/api/v1/mentorship/admin/lessons/${id}`,
    payload,
  );
  return data;
}

export async function deleteLesson(id: string): Promise<void> {
  await api.delete(`/api/v1/mentorship/admin/lessons/${id}`);
}

export async function reorderLessons(
  moduleId: string,
  ids: string[],
): Promise<void> {
  await api.patch(
    `/api/v1/mentorship/admin/modules/${moduleId}/lessons/reorder`,
    { ids },
  );
}
