import { api } from "@/lib/api/client";
import type { Plan } from "@/lib/api/billing";

/** O que dispara o alerta — espelha o enum `AlertKind` do backend. */
export type AlertKind = "AUTHOR" | "CHANNEL" | "KEYWORD";

export interface AlertRule {
  id: string;
  kind: AlertKind;
  /** authorTag / channelId exatos; termo em minúsculas. */
  value: string;
  label: string | null;
  isActive: boolean;
  /**
   * Se a regra DISPARA hoje. No FREE só a mais antiga ativa vale — quem caiu do
   * Pro mantém as outras guardadas, mas elas não disparam.
   */
  effective: boolean;
  createdAt: string;
}

export interface AlertRulesResponse {
  plan: Plan;
  /** `null` = sem limite (Pro). */
  limit: number | null;
  items: AlertRule[];
}

export interface AppNotification {
  id: string;
  title: string;
  body: string;
  readAt: string | null;
  createdAt: string;
  capturedMessageId: string;
}

export interface NotificationsPage {
  items: AppNotification[];
  nextCursor: string | null;
}

export async function getAlertRules(): Promise<AlertRulesResponse> {
  const { data } = await api.get<AlertRulesResponse>("/api/v1/alerts/rules");
  return data;
}

export async function createAlertRule(input: {
  kind: AlertKind;
  value: string;
  label?: string;
}): Promise<AlertRule> {
  const { data } = await api.post<AlertRule>("/api/v1/alerts/rules", input);
  return data;
}

export async function updateAlertRule(
  id: string,
  input: { isActive?: boolean; label?: string },
): Promise<AlertRule> {
  const { data } = await api.patch<AlertRule>(`/api/v1/alerts/rules/${id}`, input);
  return data;
}

export async function deleteAlertRule(id: string): Promise<void> {
  await api.delete(`/api/v1/alerts/rules/${id}`);
}

export async function getNotifications(cursor?: string): Promise<NotificationsPage> {
  const { data } = await api.get<NotificationsPage>("/api/v1/notifications", {
    params: { cursor, limit: 20 },
  });
  return data;
}

export async function getUnreadCount(): Promise<number> {
  const { data } = await api.get<{ count: number }>("/api/v1/notifications/unread-count");
  return data.count;
}

export async function markNotificationRead(id: string): Promise<void> {
  await api.post(`/api/v1/notifications/${id}/read`);
}

export async function markAllNotificationsRead(): Promise<void> {
  await api.post("/api/v1/notifications/read-all");
}

/** `null` = o backend está sem chaves VAPID (push desligado no ambiente). */
export async function getPushPublicKey(): Promise<string | null> {
  const { data } = await api.get<{ publicKey: string | null }>(
    "/api/v1/notifications/push/key",
  );
  return data.publicKey;
}

export async function savePushSubscription(sub: PushSubscriptionJSON): Promise<void> {
  await api.post("/api/v1/notifications/push/subscriptions", {
    endpoint: sub.endpoint,
    keys: sub.keys,
  });
}

export async function removePushSubscription(endpoint: string): Promise<void> {
  await api.delete("/api/v1/notifications/push/subscriptions", { data: { endpoint } });
}

/** Chaves do React Query — o socket e as mutações invalidam por elas. */
export const ALERT_RULES_KEY = ["alert-rules"] as const;
export const NOTIFICATIONS_KEY = ["notifications"] as const;
export const UNREAD_KEY = ["notifications-unread"] as const;
