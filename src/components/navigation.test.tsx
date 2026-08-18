import {
  cleanup,
  fireEvent,
  render,
  screen,
  waitFor,
} from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("next/navigation", () => ({
  usePathname: () => "/net-worth",
}));

import { DesktopNavigation, MobileNavigation } from "./navigation";

afterEach(() => {
  cleanup();
  document.body.style.overflow = "";
});

describe("responsive navigation", () => {
  it("portals a bounded modal drawer outside the backdrop-blurred header", async () => {
    const { container } = render(
      <header className="backdrop-blur">
        <MobileNavigation />
      </header>,
    );

    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const dialog = screen.getByRole("dialog", { name: "Personal Finance" });

    expect(dialog.parentElement?.parentElement).toBe(document.body);
    expect(dialog).toHaveClass(
      "h-dvh",
      "max-w-full",
      "overflow-y-auto",
      "overscroll-contain",
    );
    expect(container.querySelector("[role='dialog']")).toBeNull();
    expect(document.body.style.overflow).toBe("hidden");
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: "Close navigation" }),
      ).toHaveFocus(),
    );
  });

  it("traps focus, closes with Escape, restores focus, and unlocks scrolling", async () => {
    render(<MobileNavigation />);
    const trigger = screen.getByRole("button", { name: "Open navigation" });
    fireEvent.click(trigger);

    const close = screen.getByRole("button", { name: "Close navigation" });
    const lastLink = screen.getByRole("link", { name: "Settings" });
    close.focus();
    fireEvent.keyDown(document, { key: "Tab", shiftKey: true });
    expect(lastLink).toHaveFocus();
    fireEvent.keyDown(document, { key: "Tab" });
    expect(close).toHaveFocus();

    fireEvent.keyDown(document, { key: "Escape" });
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
    expect(trigger).toHaveFocus();
    expect(trigger).toHaveAttribute("aria-expanded", "false");
    expect(document.body.style.overflow).toBe("");
  });

  it("closes after navigation and preserves the desktop sidebar breakpoint", async () => {
    const { rerender } = render(<MobileNavigation />);
    fireEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    const overviewLink = screen.getByRole("link", { name: "Overview" });
    overviewLink.addEventListener("click", (event) => event.preventDefault(), {
      once: true,
    });
    fireEvent.click(overviewLink);
    await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());

    rerender(<DesktopNavigation />);
    expect(screen.getByRole("complementary")).toHaveClass("hidden", "lg:block");
  });
});
