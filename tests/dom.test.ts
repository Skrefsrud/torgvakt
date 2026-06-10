// @vitest-environment jsdom
import { domFallbackListing, findDisposedBadge, findPriceElement } from "../src/content/dom";

test("domFallbackListing builds a listing from URL id + visible price + doc title", () => {
  const p = domFallbackListing("461484344", "300 kr", "Togbillett Stavanger - Oslo S 29.4 | FINN-torget");
  expect(p).toEqual({
    id: "461484344", title: "Togbillett Stavanger - Oslo S 29.4",
    image: "", price: 300, availability: "unknown",
  });
  expect(domFallbackListing("461484344", "Gis bort", "X | FINN-torget")).toBeNull();
  expect(domFallbackListing("", "300 kr", "X")).toBeNull();
});

test("finds the visible price element", () => {
  document.body.innerHTML = `<main><h1>Sykkel</h1><p>God stand</p><span>500 kr</span></main>`;
  expect(findPriceElement(document)?.textContent).toBe("500 kr");
});

test("ignores prices buried in long text", () => {
  document.body.innerHTML = `<main><p>Ny pris i butikk var 9 000 kr for denne.</p></main>`;
  expect(findPriceElement(document)).toBeNull();
});

test("detects the Solgt badge through shadow roots", () => {
  document.body.innerHTML = `<div id="host"></div>`;
  const root = document.getElementById("host")!.attachShadow({ mode: "open" });
  root.innerHTML = `<div class="badge--warning font-bold mb-16">Solgt</div><p>500 kr</p>`;
  expect(findDisposedBadge(document)).toBe("Solgt");
});

test("ignores warning badges with unrelated text", () => {
  document.body.innerHTML = `<div class="badge--warning">Ny pris</div>`;
  expect(findDisposedBadge(document)).toBeNull();
});

test("finds price inside open shadow DOM (finn.no uses declarative shadow roots)", () => {
  document.body.innerHTML = `<div id="host"></div>`;
  const host = document.getElementById("host")!;
  const root = host.attachShadow({ mode: "open" });
  root.innerHTML = `<h2>Til salgs</h2><p class="m-0 h2">500 kr</p>`;
  expect(findPriceElement(document)?.textContent).toBe("500 kr");
});

test("finds price in nested shadow roots", () => {
  document.body.innerHTML = `<div id="outer"></div>`;
  const outer = document.getElementById("outer")!.attachShadow({ mode: "open" });
  outer.innerHTML = `<div id="inner"></div>`;
  const inner = outer.getElementById("inner")!.attachShadow({ mode: "open" });
  inner.innerHTML = `<span>1 234 kr</span>`;
  expect(findPriceElement(document)?.textContent).toBe("1 234 kr");
});
