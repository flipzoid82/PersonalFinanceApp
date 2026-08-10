"use client";

import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

export const ACTIVE_SEARCH_DEBOUNCE_MS = 300;

export function ActiveTransactionSearch({
  initialValue,
}: {
  initialValue: string;
}) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const urlSearch = searchParams.get("search") ?? initialValue;
  const [value, setValue] = useState(urlSearch);
  const valueRef = useRef(value);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputVersion = useRef(0);
  const localRequests = useRef(new Map<string, number>());
  const historyNavigation = useRef(false);

  useEffect(() => {
    function markHistoryNavigation() {
      historyNavigation.current = true;
    }
    window.addEventListener("popstate", markHistoryNavigation);
    return () => {
      window.removeEventListener("popstate", markHistoryNavigation);
      if (timer.current) clearTimeout(timer.current);
    };
  }, []);

  useEffect(() => {
    const requestVersion = localRequests.current.get(urlSearch);
    const isStaleLocalResponse =
      requestVersion !== undefined && requestVersion < inputVersion.current;
    const isCurrentLocalResponse = requestVersion === inputVersion.current;

    if (
      !historyNavigation.current &&
      (isStaleLocalResponse || isCurrentLocalResponse)
    )
      return;

    historyNavigation.current = false;
    localRequests.current.clear();
    if (timer.current) clearTimeout(timer.current);
    if (valueRef.current !== urlSearch) {
      valueRef.current = urlSearch;
      // The URL is external navigation state; synchronize only when it was not
      // produced by an older local request.
      setValue(urlSearch);
    }
  }, [urlSearch]);

  function scheduleSearch(nextValue: string) {
    const version = ++inputVersion.current;
    valueRef.current = nextValue;
    setValue(nextValue);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      const query = new URLSearchParams(searchParams.toString());
      const normalized = nextValue.trim().slice(0, 120);
      if (normalized) query.set("search", normalized);
      else query.delete("search");
      query.delete("page");
      localRequests.current.set(normalized, version);
      const serialized = query.toString();
      router.replace(serialized ? `${pathname}?${serialized}` : pathname, {
        scroll: false,
      });
    }, ACTIVE_SEARCH_DEBOUNCE_MS);
  }

  return (
    <input
      name="search"
      type="search"
      value={value}
      onChange={(event) => scheduleSearch(event.target.value)}
      maxLength={120}
      placeholder="Search transactions"
      autoComplete="off"
      className="mt-1 min-h-11 w-full rounded-lg border border-[var(--border-default)] bg-[var(--surface-panel)] px-3 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--focus-ring)]"
    />
  );
}
