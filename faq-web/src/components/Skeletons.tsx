"use client";

import { cn } from "@/lib/utils";

function Shimmer({ className }: { className?: string }) {
  return <div className={cn("animate-pulse rounded bg-border/60", className)} />;
}

export function FAQCardSkeleton() {
  return (
    <div className="rounded-xl border border-border bg-card p-4 sm:p-5">
      <div className="flex items-start gap-3">
        <Shimmer className="w-10 h-5 rounded shrink-0 mt-0.5" />
        <div className="flex-1 space-y-2">
          <Shimmer className="h-4 w-full" />
          <Shimmer className="h-4 w-3/4" />
        </div>
        <Shimmer className="w-4 h-4 rounded shrink-0 mt-1" />
      </div>
    </div>
  );
}

export function FAQPageSkeleton() {
  return (
    <div className="space-y-3">
      <Shimmer className="h-6 w-40 mb-4 mt-2" />
      {[0, 1, 2, 3, 4].map((i) => <FAQCardSkeleton key={i} />)}
      <Shimmer className="h-6 w-32 mb-4 mt-8" />
      {[0, 1, 2].map((i) => <FAQCardSkeleton key={i + 5} />)}
    </div>
  );
}

export function CommunityCardSkeleton() {
  return (
    <div className="rounded-2xl border border-border bg-card p-5">
      <div className="flex gap-2 mb-3">
        <Shimmer className="h-5 w-20 rounded-full" />
        <Shimmer className="h-5 w-16 rounded-full" />
      </div>
      <Shimmer className="h-5 w-full mb-2" />
      <Shimmer className="h-5 w-4/5 mb-4" />
      <div className="flex gap-4">
        <Shimmer className="h-3.5 w-16" />
        <Shimmer className="h-3.5 w-20" />
        <Shimmer className="h-3.5 w-14" />
      </div>
      <div className="mt-4 flex gap-2">
        <Shimmer className="h-9 flex-1 rounded-xl" />
        <Shimmer className="h-9 w-32 rounded-xl" />
      </div>
    </div>
  );
}

export function CommunityPageSkeleton() {
  return (
    <div className="space-y-4">
      {[0, 1, 2, 3].map((i) => <CommunityCardSkeleton key={i} />)}
    </div>
  );
}

export function MyContributionsSkeleton() {
  return (
    <div className="space-y-10">
      <section>
        <Shimmer className="h-4 w-48 mb-3" />
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <Shimmer className="h-4 w-3/4 mb-2" />
              <Shimmer className="h-3 w-32" />
            </div>
          ))}
        </div>
      </section>
      <section>
        <Shimmer className="h-4 w-48 mb-3" />
        <div className="space-y-2">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-xl border border-border bg-card p-4">
              <div className="flex justify-between mb-2">
                <Shimmer className="h-3 w-1/2" />
                <Shimmer className="h-5 w-16 rounded-full" />
              </div>
              <Shimmer className="h-3 w-full mb-1" />
              <Shimmer className="h-3 w-4/5" />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}