import rawAxios from "axios";

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

/** Rótulo do quadradinho colorido do card de material. */
export type MentorshipMaterialKind =
  "PDF" | "XLS" | "DOC" | "JSON" | "ZIP" | "LINK";

export interface MentorshipMaterial {
  id: string;
  title: string;
  url: string;
  kind: MentorshipMaterialKind;
  /** Bytes. `0` = desconhecido — o front não mostra a linha do tamanho. */
  sizeBytes: number;
}

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
  /** Anexos da aula, na ordem do admin. */
  materials: MentorshipMaterial[];
}

export interface MentorshipModule {
  id: string;
  categoryId: string;
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

/**
 * Seção da tela (Categoria → Módulo → Aula). Traz só os IDS dos módulos, na
 * ordem; os módulos completos estão em `MentorshipOverview.modules`.
 */
export interface MentorshipCategory {
  id: string;
  title: string;
  description: string;
  moduleIds: string[];
}

export interface MentorshipOverview {
  /** Seções na ordem da tela; só categorias com módulo publicado. */
  categories: MentorshipCategory[];
  /** Todos os módulos visíveis, na ordem da tela (categoria → posição). */
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
  /** Anexos da aula, gerenciados no mesmo editor. */
  materials: AdminMaterial[];
}

/** Anexo como o admin edita. */
export interface AdminMaterial {
  id: string;
  lessonId: string;
  title: string;
  url: string;
  kind: MentorshipMaterialKind;
  sizeBytes: number;
  position: number;
}

/** Trilha na LISTA do admin (sem as aulas, com a contagem delas). */
export interface AdminModuleSummary {
  id: string;
  categoryId: string;
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
export interface AdminModuleDetail extends Omit<
  AdminModuleSummary,
  "lessonCount"
> {
  lessons: AdminLesson[];
}

/** Categoria na árvore do admin, com os módulos dela (inclusive rascunhos). */
export interface AdminCategory {
  id: string;
  title: string;
  description: string;
  position: number;
  published: boolean;
  modules: AdminModuleSummary[];
}

export interface CategoryPayload {
  title: string;
  description: string;
  published: boolean;
}

export interface ModulePayload {
  /** No PATCH, trocar a categoria MOVE o módulo para o fim da nova. */
  categoryId: string;
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

/** Árvore categorias → módulos do admin. */
export const ADMIN_CATEGORIES_KEY = ["mentorship-admin-categories"] as const;

/** Chave da trilha aberta no editor — chave DIFERENTE da listagem. */
export const adminModuleKey = (id: string) =>
  ["mentorship-admin-module", id] as const;

export async function listAdminCategories(): Promise<AdminCategory[]> {
  const { data } = await api.get<AdminCategory[]>(
    "/api/v1/mentorship/admin/categories",
  );
  return data;
}

export async function createCategory(
  payload: CategoryPayload,
): Promise<AdminCategory> {
  const { data } = await api.post<AdminCategory>(
    "/api/v1/mentorship/admin/categories",
    payload,
  );
  return data;
}

export async function updateCategory(
  id: string,
  payload: Partial<CategoryPayload>,
): Promise<void> {
  await api.patch(`/api/v1/mentorship/admin/categories/${id}`, payload);
}

/** Só apaga categoria vazia — com módulos o servidor responde 409. */
export async function deleteCategory(id: string): Promise<void> {
  await api.delete(`/api/v1/mentorship/admin/categories/${id}`);
}

/** Nova ordem das categorias — a posição de cada id vira o índice. */
export async function reorderCategories(ids: string[]): Promise<void> {
  await api.patch("/api/v1/mentorship/admin/categories/reorder", { ids });
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

/** Nova ordem das trilhas DE UMA categoria — posição = índice na lista. */
export async function reorderModules(
  categoryId: string,
  ids: string[],
): Promise<void> {
  await api.patch(
    `/api/v1/mentorship/admin/categories/${categoryId}/modules/reorder`,
    { ids },
  );
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

// ── Materiais ────────────────────────────────────────────────────────────────

export interface MaterialPayload {
  title: string;
  url: string;
  kind: MentorshipMaterialKind;
  sizeBytes?: number;
  position?: number;
}

export async function createMaterial(
  lessonId: string,
  payload: MaterialPayload,
): Promise<AdminMaterial> {
  const { data } = await api.post<AdminMaterial>(
    `/api/v1/mentorship/admin/lessons/${lessonId}/materials`,
    payload,
  );
  return data;
}

export async function updateMaterial(
  id: string,
  payload: Partial<MaterialPayload>,
): Promise<AdminMaterial> {
  const { data } = await api.patch<AdminMaterial>(
    `/api/v1/mentorship/admin/materials/${id}`,
    payload,
  );
  return data;
}

export async function deleteMaterial(id: string): Promise<void> {
  await api.delete(`/api/v1/mentorship/admin/materials/${id}`);
}

// ── Upload (Cloudflare R2) ───────────────────────────────────────────────────

export type UploadKind = "cover" | "material";

export interface UploadsConfig {
  /** `false` = R2 não configurado no backend: o admin usa só link colado. */
  enabled: boolean;
  limits: Record<UploadKind, number>;
  accept: Record<UploadKind, string[]>;
}

export const UPLOADS_CONFIG_KEY = ["mentorship-admin-uploads-config"] as const;

export async function getUploadsConfig(): Promise<UploadsConfig> {
  const { data } = await api.get<UploadsConfig>(
    "/api/v1/mentorship/admin/uploads/config",
  );
  return data;
}

interface PresignedUpload {
  uploadUrl: string;
  headers: Record<string, string>;
  publicUrl: string;
}

export interface UploadedFile {
  /** URL pública — é ela que vai para `coverUrl` / `url` do material. */
  url: string;
  sizeBytes: number;
  name: string;
}

/**
 * Sobe um arquivo em dois passos:
 *  1. a API (admin) valida tipo/tamanho e devolve uma URL de PUT assinada;
 *  2. o navegador manda o arquivo DIRETO ao R2 — não passa pelo nosso servidor.
 *
 * O PUT usa um axios "cru", não a instância `api`: ela anexa o token de sessão,
 * e ele não pode vazar para o host do R2. Os headers são EXATAMENTE os que o
 * backend assinou; mudar qualquer um faz o R2 responder 403.
 */
export async function uploadMentorshipFile(
  file: File,
  kind: UploadKind,
  onProgress?: (fraction: number) => void,
  signal?: AbortSignal,
): Promise<UploadedFile> {
  const { data: presigned } = await api.post<PresignedUpload>(
    "/api/v1/mentorship/admin/uploads",
    { kind, filename: file.name, size: file.size },
  );
  await rawAxios.put(presigned.uploadUrl, file, {
    headers: presigned.headers,
    signal,
    // Sem isso o axios serializaria o File; aqui ele vai como corpo binário.
    transformRequest: [(body: unknown) => body],
    onUploadProgress: (e) => {
      if (onProgress && e.total) onProgress(e.loaded / e.total);
    },
  });
  return { url: presigned.publicUrl, sizeBytes: file.size, name: file.name };
}

// ── Métricas ─────────────────────────────────────────────────────────────────

export interface StatsLesson {
  id: string;
  title: string;
  episode: number;
  published: boolean;
  /** Quantos ABRIRAM a aula (têm linha de progresso). */
  started: number;
  completed: number;
  /** `completed / started` — quanto da audiência da aula chega ao fim. */
  completionRate: number;
}

export interface StatsModule {
  id: string;
  title: string;
  label: string;
  published: boolean;
  lessonCount: number;
  /** Usuários distintos que tocaram alguma aula deste módulo. */
  learners: number;
  completions: number;
  /** `completions / (learners × aulas)` — quanto do módulo foi vencido. */
  completionRate: number;
  lessons: StatsLesson[];
}

export interface MentorshipStats {
  totals: {
    learners: number;
    lessonsStarted: number;
    lessonsCompleted: number;
    activeLast30d: number;
  };
  modules: StatsModule[];
}

export const ADMIN_STATS_KEY = ["mentorship-admin-stats"] as const;

export async function getMentorshipStats(): Promise<MentorshipStats> {
  const { data } = await api.get<MentorshipStats>(
    "/api/v1/mentorship/admin/stats",
  );
  return data;
}

