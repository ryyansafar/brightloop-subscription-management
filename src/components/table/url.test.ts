import { describe, expect, it } from "vitest";
import { columnVisibility } from "./DataTable";
import { hrefWith, nextSort, sortParam } from "./url";

describe("sortParam", () => {
  it("accepts only allowed keys", () => {
    expect(sortParam({ sort: "name", dir: "desc" }, ["name"])).toEqual({ sort: "name", dir: "desc" });
    expect(sortParam({ sort: "evil; drop", dir: "desc" }, ["name"]).sort).toBeUndefined();
    expect(sortParam({}, ["name"])).toEqual({ sort: undefined, dir: "asc" });
  });
});

describe("nextSort", () => {
  it("cycles asc, desc, none and resets paging", () => {
    expect(nextSort({ dir: "asc" }, "name")).toEqual({ sort: "name", dir: "asc", page: undefined });
    expect(nextSort({ sort: "name", dir: "asc" }, "name")).toEqual({ sort: "name", dir: "desc", page: undefined });
    expect(nextSort({ sort: "name", dir: "desc" }, "name")).toEqual({
      sort: undefined,
      dir: undefined,
      page: undefined,
    });
    expect(nextSort({ sort: "name", dir: "desc" }, "total").sort).toBe("total");
  });

  it("builds a URL that keeps filters", () => {
    const href = hrefWith("/x", { filter: "paid", page: "3" }, nextSort({ dir: "asc" }, "total"));
    expect(href).toBe("/x?filter=paid&sort=total&dir=asc");
  });
});

describe("columnVisibility", () => {
  it("maps breakpoints", () => {
    expect(columnVisibility({})).toBe("");
    expect(columnVisibility({ hideOnMobile: true })).toBe("hidden md:table-cell");
    expect(columnVisibility({ hideBelow: "lg", hideOnMobile: true })).toBe("hidden lg:table-cell");
  });
});
