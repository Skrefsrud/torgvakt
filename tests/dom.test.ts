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
