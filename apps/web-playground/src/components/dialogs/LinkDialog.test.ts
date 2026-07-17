import { describe, expect, it } from "vitest";
import { validateLinkHref } from "./LinkDialog";

describe("validateLinkHref", () => {
  it("accepts author-facing web and email links", () => {
    expect(validateLinkHref("https://example.com/spec?q=1")).toBeNull();
    expect(validateLinkHref("http://localhost:6280/docs")).toBeNull();
    expect(validateLinkHref("mailto:author@example.com")).toBeNull();
  });

  it("rejects incomplete and unsafe protocols", () => {
    expect(validateLinkHref("")).toBe("Enter a URL");
    expect(validateLinkHref("example.com")).toContain("https://");
    expect(validateLinkHref("javascript:alert(1)")).toContain("http, https, or mailto");
    expect(validateLinkHref("file:///etc/passwd")).toContain("http, https, or mailto");
  });
});
