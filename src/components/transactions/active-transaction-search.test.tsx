import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  ACTIVE_SEARCH_DEBOUNCE_MS,
  ActiveTransactionSearch,
} from "./active-transaction-search";

const mocks = vi.hoisted(() => ({
  replace: vi.fn(),
  params: new URLSearchParams("sort=date&direction=desc&page=3"),
}));

vi.mock("next/navigation", () => ({
  useRouter: () => ({ replace: mocks.replace }),
  usePathname: () => "/transactions",
  useSearchParams: () => mocks.params,
}));

describe("ActiveTransactionSearch", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mocks.replace.mockReset();
    mocks.params = new URLSearchParams("sort=date&direction=desc&page=3");
  });

  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("debounces typing, preserves URL state, and resets pagination", () => {
    render(<ActiveTransactionSearch initialValue="" />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "c" } });
    fireEvent.change(input, { target: { value: "coffee" } });

    vi.advanceTimersByTime(ACTIVE_SEARCH_DEBOUNCE_MS - 1);
    expect(mocks.replace).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(mocks.replace).toHaveBeenCalledTimes(1);
    expect(mocks.replace).toHaveBeenCalledWith(
      "/transactions?sort=date&direction=desc&search=coffee",
      { scroll: false },
    );
  });

  it("synchronizes browser history state and blocks a stale pending search", () => {
    const { rerender } = render(<ActiveTransactionSearch initialValue="old" />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "stale" } });

    mocks.params = new URLSearchParams(
      "sort=amount&direction=asc&search=back-value",
    );
    rerender(<ActiveTransactionSearch initialValue="old" />);
    expect(screen.getByRole("searchbox")).toHaveValue("back-value");
    vi.advanceTimersByTime(ACTIVE_SEARCH_DEBOUNCE_MS);
    expect(mocks.replace).not.toHaveBeenCalled();

    fireEvent.change(screen.getByRole("searchbox"), {
      target: { value: "newest" },
    });
    vi.advanceTimersByTime(ACTIVE_SEARCH_DEBOUNCE_MS);
    expect(mocks.replace).toHaveBeenCalledWith(
      "/transactions?sort=amount&direction=asc&search=newest",
      { scroll: false },
    );
  });

  it("does not let an older in-flight URL response replace a newer draft", () => {
    const { rerender } = render(<ActiveTransactionSearch initialValue="" />);
    const input = screen.getByRole("searchbox");
    fireEvent.change(input, { target: { value: "Starbucks" } });
    vi.advanceTimersByTime(ACTIVE_SEARCH_DEBOUNCE_MS);
    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/transactions?sort=date&direction=desc&search=Starbucks",
      { scroll: false },
    );

    fireEvent.change(input, { target: { value: "McDonald's" } });
    mocks.params = new URLSearchParams(
      "sort=date&direction=desc&search=Starbucks",
    );
    rerender(<ActiveTransactionSearch initialValue="" />);
    expect(screen.getByRole("searchbox")).toHaveValue("McDonald's");

    vi.advanceTimersByTime(ACTIVE_SEARCH_DEBOUNCE_MS);
    expect(mocks.replace).toHaveBeenLastCalledWith(
      "/transactions?sort=date&direction=desc&search=McDonald%27s",
      { scroll: false },
    );
  });
});
