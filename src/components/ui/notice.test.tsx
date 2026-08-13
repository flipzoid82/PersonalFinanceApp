import { CircleAlert } from "lucide-react";
import { render, screen } from "@testing-library/react";
import { createRef } from "react";
import { describe, expect, it } from "vitest";
import { Notice, type NoticeTone } from "./notice";

describe("Notice", () => {
  it.each([
    ["info", "--semantic-info"],
    ["warning", "--semantic-warning"],
    ["positive", "--semantic-positive"],
    ["negative", "--semantic-negative"],
  ] satisfies Array<[NoticeTone, string]>)(
    "uses theme-safe %s semantic classes",
    (tone, token) => {
      const { container } = render(
        <Notice tone={tone} role="status">
          Body
        </Notice>,
      );

      const notice = container.firstElementChild;
      expect(notice).not.toBeNull();
      if (!notice) {
        throw new Error("Notice was not rendered.");
      }
      expect(notice.className).toContain(`${token}-border`);
      expect(notice.className).toContain(`${token}-bg`);
      expect(notice.className).toContain(`${token}-text`);
      expect(notice.className).not.toMatch(
        /(?:bg|border|text)-(?:amber|emerald|red|rose|white)-/,
      );
    },
  );

  it("renders a title, body, optional icon and actions", () => {
    render(
      <Notice
        tone="warning"
        title="Review required"
        icon={CircleAlert}
        actions={<button type="button">Review</button>}
      >
        Check the available details.
      </Notice>,
    );

    expect(screen.getByText("Review required")).toBeVisible();
    expect(screen.getByText("Check the available details.")).toBeVisible();
    expect(screen.getByRole("button", { name: "Review" })).toBeVisible();
    expect(document.querySelector("svg")).toHaveAttribute(
      "aria-hidden",
      "true",
    );
  });

  it("propagates roles, focusability and refs without forcing focus", () => {
    const ref = createRef<HTMLDivElement>();
    render(
      <Notice ref={ref} tone="negative" role="alert" tabIndex={-1}>
        Update failed.
      </Notice>,
    );

    const notice = screen.getByRole("alert");
    expect(ref.current).toBe(notice);
    expect(notice).toHaveAttribute("tabindex", "-1");
    expect(notice).not.toHaveFocus();
  });
});
