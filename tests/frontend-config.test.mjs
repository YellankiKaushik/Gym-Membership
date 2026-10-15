import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import vm from "node:vm";
import { build } from "esbuild";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";

async function renderApp(config = {}) {
  const bundle = await build({
    entryPoints: ["src/App.tsx"],
    bundle: true,
    write: false,
    platform: "node",
    format: "cjs",
    packages: "external",
    jsx: "automatic",
    logLevel: "silent",
    loader: { ".jpg": "dataurl" },
    define: { __GYM_PUBLIC_CONFIG__: JSON.stringify(config) },
  });
  const module = { exports: {} };
  vm.runInNewContext(bundle.outputFiles[0].text, {
    module,
    exports: module.exports,
    require: createRequire(import.meta.url),
  });
  return renderToStaticMarkup(React.createElement(module.exports.default));
}

test("fresh public app starts with member lookup without a technical endpoint setup screen", async () => {
  const html = await renderApp();
  assert.match(html, /id="member-id"/);
  assert.match(html, /Check your membership/);
  assert.ok(
    !html.includes("Apps Script") &&
      !html.includes("API URL") &&
      !html.includes("Setup"),
  );
});

test("installation branding, trainer, logo, contact and gallery use one configuration", async () => {
  const html = await renderApp({
    name: "STAGING ONLY Custom Gym",
    tagline: "Example tagline",
    trainerName: "STAGING ONLY Trainer",
    address: "STAGING ONLY Location",
    mapUrl: "https://example.invalid/map",
    logoUrl: "/custom-logo.png",
    galleryImages: "/one.jpg,/two.jpg",
    contactPhone: "0000000000",
    contactEmail: "gym@example.invalid",
  });
  for (const value of [
    "STAGING ONLY Custom Gym",
    "Example tagline",
    "STAGING ONLY Trainer",
    "STAGING ONLY Location",
    "/custom-logo.png",
    "/one.jpg",
    "/two.jpg",
    "gym@example.invalid",
  ])
    assert.ok(html.includes(value));
  assert.ok(!html.includes("FitZone"));
});

test("blank or whitespace-only gallery configuration retains the bundled gym photos", async () => {
  for (const galleryImages of ["", " , , "]) {
    const html = await renderApp({ galleryImages });
    assert.equal((html.match(/training space [123]/g) || []).length, 3);
  }
});
