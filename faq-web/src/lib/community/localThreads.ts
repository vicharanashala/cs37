import { threadsData } from "@/data/threadsData";
import type { Reply, Thread } from "@/lib/community/threadModel";

declare global {
  var _localCommunityReplies:
    | Map<string, Reply[]>
    | undefined;
}

const localReplies =
  globalThis._localCommunityReplies ?? new Map<string, Reply[]>();

globalThis._localCommunityReplies = localReplies;

export function getLocalThreads(category?: string | null): Thread[] {
  const threads = threadsData.map((thread) => ({
    ...thread,
    initialAnswer: thread.initialAnswer ?? null,
    answeredBy: thread.answeredBy ?? null,
    answeredByRole: thread.answeredByRole ?? null,
    resolvedAt: thread.resolvedAt ?? null,
    replies: [...thread.replies, ...(localReplies.get(thread.id) ?? [])],
  })) satisfies Thread[];

  return category
    ? threads.filter((thread) => thread.category === category)
    : threads;
}

export function findLocalThread(id: string): Thread | null {
  return getLocalThreads().find((thread) => thread.id === id) ?? null;
}

export function addLocalReply(threadId: string, reply: Reply): void {
  localReplies.set(threadId, [...(localReplies.get(threadId) ?? []), reply]);
}
