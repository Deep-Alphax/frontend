"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import * as Popover from "@radix-ui/react-popover";
import {
  useInfiniteQuery,
  useMutation,
  useQuery,
  useQueryClient,
  type InfiniteData,
} from "@tanstack/react-query";
import { Bell, Settings } from "lucide-react";

import {
  getNotifications,
  getUnreadCount,
  markAllNotificationsRead,
  markNotificationRead,
  NOTIFICATIONS_KEY,
  UNREAD_KEY,
  type AppNotification,
  type NotificationsPage,
} from "@/lib/api/alerts";
import { timeAgo } from "@/lib/api/affiliates";
import { useAccountEvents } from "@/lib/alerts/useAccountEvents";
import { ScrollArea } from "@/components/ui/ScrollArea";
import { cn } from "@/lib/cn";
import { Skeleton, SkeletonGroup } from "@/components/ui/Skeleton";

/**
 * Sininho do header: badge de não lidas + painel com as notificações.
 *
 * O badge é uma query leve (`count`) carregada logo; a LISTA só é buscada
 * quando o painel abre — ninguém paga 20 notificações por page view. Novas
 * chegam pelo socket (`useAccountEvents`), sem polling.
 */
export function NotificationBell() {
  const qc = useQueryClient();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useAccountEvents(true);

  const { data: unread = 0 } = useQuery({
    queryKey: UNREAD_KEY,
    queryFn: getUnreadCount,
    staleTime: 60_000,
  });

  const list = useInfiniteQuery({
    queryKey: NOTIFICATIONS_KEY,
    queryFn: ({ pageParam }) => getNotifications(pageParam),
    initialPageParam: undefined as string | undefined,
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    enabled: open,
    staleTime: 30_000,
  });
  const items = list.data?.pages.flatMap((p) => p.items) ?? [];

  /** Marca lida no cache na hora (o clique já navega; não esperar o servidor). */
  const markLocal = (ids: Set<string> | "all") => {
    const now = new Date().toISOString();
    qc.setQueryData<InfiniteData<NotificationsPage, string | undefined>>(
      NOTIFICATIONS_KEY,
      (prev) =>
        prev && {
          ...prev,
          pages: prev.pages.map((p) => ({
            ...p,
            items: p.items.map((n) =>
              !n.readAt && (ids === "all" || ids.has(n.id)) ? { ...n, readAt: now } : n,
            ),
          })),
        },
    );
  };

  const readOne = useMutation({
    mutationFn: markNotificationRead,
    onMutate: (id) => {
      markLocal(new Set([id]));
      qc.setQueryData<number>(UNREAD_KEY, (c) => Math.max(0, (c ?? 1) - 1));
    },
    onError: () => qc.invalidateQueries({ queryKey: UNREAD_KEY }),
  });

  const readAll = useMutation({
    mutationFn: markAllNotificationsRead,
    onMutate: () => {
      markLocal("all");
      qc.setQueryData<number>(UNREAD_KEY, 0);
    },
    onError: () => qc.invalidateQueries({ queryKey: UNREAD_KEY }),
  });

  const openNotification = (n: AppNotification) => {
    if (!n.readAt) readOne.mutate(n.id);
    setOpen(false);
    router.push(`/radar?message=${encodeURIComponent(n.capturedMessageId)}`);
  };

  const badge = unread > 99 ? "99+" : String(unread);

  return (
    <Popover.Root open={open} onOpenChange={setOpen}>
      <Popover.Trigger asChild>
        <button
          type="button"
          aria-label={unread > 0 ? `Notifications (${unread} unread)` : "Notifications"}
          className="relative flex size-9 items-center justify-center rounded-lg text-gray-12 transition-colors hover:bg-gray-3 data-[state=open]:bg-gray-3"
        >
          <Bell className="size-6" strokeWidth={1.5} />
          {unread > 0 && (
            <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 items-center justify-center rounded-full bg-principal-9 px-1 text-[10px] font-bold leading-none text-gray-1 tabular-nums">
              {badge}
            </span>
          )}
        </button>
      </Popover.Trigger>

      <Popover.Portal>
        <Popover.Content
          align="end"
          sideOffset={8}
          collisionPadding={16}
          className="z-50 flex max-h-[min(520px,calc(100dvh-96px))] w-[min(380px,calc(100vw-32px))] flex-col overflow-hidden rounded-lg border border-gray-6 bg-gray-2"
        >
          <div className="flex items-center justify-between gap-2 border-b border-gray-6 px-4 py-3">
            <p className="text-sm font-semibold text-gray-12">Notifications</p>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  type="button"
                  onClick={() => readAll.mutate()}
                  className="rounded-md px-2 py-1 text-xs font-medium text-secundaria-11 transition-colors hover:bg-gray-3"
                >
                  Mark all as read
                </button>
              )}
              <Link
                href="/alerts"
                onClick={() => setOpen(false)}
                aria-label="Alert settings"
                className="flex size-7 items-center justify-center rounded-md text-gray-11 transition-colors hover:bg-gray-3 hover:text-gray-12"
              >
                <Settings className="size-4" />
              </Link>
            </div>
          </div>

          {/* Popover é `max-h`: o viewport encolhe como item flex, não `h-full`. */}
          <ScrollArea className="flex min-h-0 flex-1 flex-col" viewportClassName="min-h-0 flex-1">
            {list.isLoading ? (
              <SkeletonGroup className="flex flex-col">
                {Array.from({ length: 4 }).map((_, i) => (
                  <div key={i} className="flex gap-3 border-b border-gray-6 px-4 py-3">
                    <Skeleton className="size-8 shrink-0 rounded-full" />
                    <div className="flex flex-1 flex-col gap-2">
                      <Skeleton className="h-3.5 w-3/4" />
                      <Skeleton className="h-3 w-1/2" />
                    </div>
                  </div>
                ))}
              </SkeletonGroup>
            ) : items.length === 0 ? (
              <div className="flex flex-col items-center gap-2 px-6 py-10 text-center">
                <p className="text-sm font-medium text-gray-12">No notifications yet</p>
                <p className="text-[13px] leading-[1.4] text-gray-11">
                  Create an alert for a caller, a channel or a ticker and you&apos;ll be
                  notified here the moment it shows up.
                </p>
                <Link
                  href="/alerts"
                  onClick={() => setOpen(false)}
                  className="mt-1 rounded-lg bg-principal-9 px-3 py-2 text-sm font-semibold text-gray-1 transition-colors hover:bg-principal-10"
                >
                  Create an alert
                </Link>
              </div>
            ) : (
              <ul>
                {items.map((n) => (
                  <li key={n.id}>
                    <button
                      type="button"
                      onClick={() => openNotification(n)}
                      className={cn(
                        "flex w-full gap-3 border-b border-gray-6/60 px-4 py-3 text-left transition-colors hover:bg-gray-3",
                        !n.readAt && "bg-principal-9/5",
                      )}
                    >
                      <span
                        aria-hidden
                        className={cn(
                          "mt-1.5 size-2 shrink-0 rounded-full",
                          n.readAt ? "bg-transparent" : "bg-principal-9",
                        )}
                      />
                      <span className="flex min-w-0 flex-1 flex-col gap-1">
                        <span className="flex items-baseline justify-between gap-2">
                          <span className="truncate text-sm font-semibold text-gray-12">
                            {n.title}
                          </span>
                          <span className="shrink-0 text-xs text-gray-11">
                            {timeAgo(n.createdAt)}
                          </span>
                        </span>
                        <span className="line-clamp-2 text-[13px] leading-[1.4] text-gray-11">
                          {n.body}
                        </span>
                      </span>
                    </button>
                  </li>
                ))}
                {list.hasNextPage && (
                  <li className="flex justify-center py-3">
                    <button
                      type="button"
                      onClick={() => list.fetchNextPage()}
                      disabled={list.isFetchingNextPage}
                      className="text-xs font-medium text-secundaria-11 hover:underline disabled:opacity-60"
                    >
                      {list.isFetchingNextPage ? "Loading…" : "Load more"}
                    </button>
                  </li>
                )}
              </ul>
            )}
          </ScrollArea>
        </Popover.Content>
      </Popover.Portal>
    </Popover.Root>
  );
}
