// @vitest-environment jsdom
import { findPriceElement } from "../src/content/dom";

test("finds the visible price element", () => {
  document.body.innerHTML = `<main><h1>Sykkel</h1><p>God stand</p><span>500 kr</span></main>`;
  expect(findPriceElement(document)?.textContent).toBe("500 kr");
});

test("ignores prices buried in long text", () => {
  document.body.innerHTML = `<main><p>Ny pris i butikk var 9 000 kr for denne.</p></main>`;
  expect(findPriceElement(document)).toBeNull();
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
