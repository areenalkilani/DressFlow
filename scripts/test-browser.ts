import { chromium } from "@playwright/test";
import { build } from "esbuild";
import { createServer } from "node:http";
import { spawn } from "node:child_process";
import { readFile, readdir, mkdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import assert from "node:assert/strict";

async function main() {
  const compiled = await build({
    entryPoints: ["tests/browser/entry.tsx"],
    bundle: true,
    write: false,
    format: "iife",
    jsx: "automatic",
    define: { "process.env.NODE_ENV": '"development"' },
    plugins: [
      {
        name: "isolated-client-test",
        setup(b) {
          b.onResolve({ filter: /^@\/app\/actions$/ }, () => ({
            path: "actions",
            namespace: "fixture",
          }));
          b.onResolve({ filter: /^next\/navigation$/ }, () => ({
            path: "navigation",
            namespace: "fixture",
          }));
          b.onLoad({ filter: /.*/, namespace: "fixture" }, (args) => ({
            contents:
              args.path === "navigation"
                ? "export function useRouter(){return {refresh(){}}}"
                : `const unavailable=async()=>{throw Error('Test harness: server actions require Supabase.');}; ${["login", "logout", "previewBooking", "checkAvailability", "saveBooking", "payment", "transition", "cancelBooking", "fitting", "readNotice", "saveRecord", "createDressVariants", "deleteRecord", "saveOffer", "uploadImage", "saveSettings", "changePassword", "changeEmail", "resendEmailChange", "saveShop"].map((n) => `export const ${n}=unavailable;`).join("\n")}`,
            loader: "js",
          }));
        },
      },
    ],
  });
  const cssFiles = (await readdir(".next/static/chunks")).filter((f) =>
    f.endsWith(".css"),
  );
  assert.ok(cssFiles.length, "Run npm run build first.");
  const css = (
    await Promise.all(
      cssFiles.map((f) => readFile(`.next/static/chunks/${f}`, "utf8")),
    )
  ).join("\n");
  const harness = createServer((req, res) => {
    if (req.url === "/app.js") {
      res.setHeader("Content-Type", "text/javascript; charset=utf-8");
      res.end(compiled.outputFiles[0].text);
    } else {
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(
        `<!doctype html><html lang="ar" dir="rtl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><style>${css}</style></head><body><div id="root"></div><script src="/app.js"></script></body></html>`,
      );
    }
  });
  await new Promise<void>((r) => harness.listen(0, "127.0.0.1", r));
  const address = harness.address();
  if (!address || typeof address === "string")
    throw Error("Invalid test address");
  const harnessUrl = `http://127.0.0.1:${address.port}`;
  const port = 3217;
  const app = spawn(
    process.execPath,
    ["node_modules/next/dist/bin/next", "start", "--port", String(port)],
    {
      windowsHide: true,
      stdio: "pipe",
      env: {
        ...process.env,
        NEXT_PUBLIC_SUPABASE_URL: "",
        NEXT_PUBLIC_SUPABASE_ANON_KEY: "",
        SUPABASE_SERVICE_ROLE_KEY: "",
      },
    },
  );
  let output = "";
  app.stdout.on("data", (d) => (output += String(d)));
  app.stderr.on("data", (d) => (output += String(d)));
  const edge = "C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe";
  const browser = await chromium.launch({
    headless: true,
    ...(existsSync(edge) ? { executablePath: edge } : {}),
  });
  try {
    for (let i = 0; i < 60; i++) {
      try {
        const r = await fetch(`http://localhost:${port}/login`);
        if (r.ok) break;
      } catch {}
      if (i === 59) throw Error(output);
      await new Promise((r) => setTimeout(r, 500));
    }
    await mkdir("test-results", { recursive: true });
    const page = await browser.newPage({
      viewport: { width: 1440, height: 1050 },
    });
    const errors: string[] = [];
    page.on("pageerror", (e) => errors.push(e.message));
    await page.goto(`http://localhost:${port}/`);
    await page
      .getByRole("heading", { name: "لنبدأ بإعداد الاتصال" })
      .or(page.getByLabel("البريد الإلكتروني", { exact: true }))
      .waitFor();
    const unconfigured =
      (await page
        .getByRole("heading", { name: "لنبدأ بإعداد الاتصال" })
        .count()) > 0;
    assert.equal(await page.locator("html").getAttribute("dir"), "rtl");
    await page.goto(`http://localhost:${port}/login`);
    await page
      .getByLabel("البريد الإلكتروني", { exact: true })
      .fill("shop@example.com");
    assert.equal(
      await page
        .getByLabel("البريد الإلكتروني", { exact: true })
        .evaluate((el: HTMLInputElement) => el.validity.typeMismatch),
      false,
    );
    assert.equal(
      await page.getByRole("button", { name: "تسجيل الدخول ←" }).isDisabled(),
      unconfigured,
    );
    assert.equal(
      await page.getByText("Create Account", { exact: true }).count(),
      0,
    );
    await page
      .getByRole("button", { name: "دخول مدير النظام", exact: true })
      .click();
    await page.getByLabel("البريد الإلكتروني", { exact: true }).waitFor();
    await page.screenshot({
      path: "test-results/login-desktop.png",
      fullPage: true,
    });
    await page.goto(`http://localhost:${port}/admin`);
    await page
      .getByRole("heading", { name: "لنبدأ بإعداد الاتصال" })
      .or(page.getByLabel("البريد الإلكتروني", { exact: true }))
      .waitFor();
    console.log(
      "PASS: real setup/login/admin protection, Arabic RTL, email input validity, no fake sign-in",
    );
    await page.goto(harnessUrl);
    await page.getByRole("heading", { name: /أهلاً أرين/ }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "test-results/workspace-desktop.png",
      fullPage: true,
    });
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "الحجوزات", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "الحجوزات", exact: true })
      .waitFor();
    await page.getByRole("button", { name: "حجز جديد", exact: true }).click();
    await page.getByRole("dialog").waitFor();
    await page.getByLabel("الاسم الكامل", { exact: true }).fill("سارة");
    await page
      .getByRole("dialog")
      .getByLabel("العنوان", { exact: true })
      .fill("بيرزيت");
    assert.equal(await page.getByLabel("المدينة", { exact: true }).count(), 0);
    const price = page.getByLabel("السعر المتفق عليه", { exact: false });
    await price.fill("850");
    await price.press("ArrowUp");
    await price.press("ArrowDown");
    await price.hover();
    await page.mouse.wheel(0, 120);
    assert.equal(await price.inputValue(), "850");
    assert.equal(
      await page
        .getByRole("button", { name: "تأكيد وحفظ الحجز", exact: true })
        .isDisabled(),
      true,
    );
    await page.keyboard.press("Escape");
    await page.getByRole("dialog").waitFor({ state: "hidden" });
    for (const name of [
      "البدلات والفساتين",
      "مواعيد البروفا",
      "العروض والخصومات",
      "العميلات",
    ]) {
      await page
        .getByRole("navigation")
        .getByRole("button", { name, exact: true })
        .click();
      await page.getByRole("heading", { name, exact: true }).waitFor();
    }
    await page
      .getByRole("button", { name: "إعدادات المتجر", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "إعدادات المتجر", exact: true })
      .waitFor();
    console.log(
      "PASS: workspace navigation, empty states, booking dialog keyboard close and save guard",
    );
    await page.getByLabel(/هاتف التواصل/).fill("+972599555555");
    await page.getByText("shop@example.com", { exact: true }).waitFor();
    await page
      .getByLabel("البريد الجديد", { exact: true })
      .fill("new@example.com");
    await page.goto(harnessUrl + "/#page=dashboard");
    await page.getByRole("heading", { name: /أهلاً أرين/ }).waitFor();
    assert.equal(
      await page
        .getByRole("navigation")
        .getByRole("button", { name: "لوحة التحكم", exact: true })
        .count(),
      0,
    );
    assert.equal(new URL(page.url()).hash, "#page=home");
    await page.getByText("إجمالي قيمة الحجوزات", { exact: true }).waitFor();
    await page
      .getByRole("heading", { name: "المتابعات القادمة", exact: true })
      .waitFor();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "العروض والخصومات", exact: true })
      .click();
    await page.getByRole("button", { name: "إضافة عرض", exact: true }).click();
    await page
      .getByRole("button", { name: "باقة بسعر واحد", exact: false })
      .click();
    await page
      .getByLabel("السعر الإجمالي للباقة (شيكل)", { exact: true })
      .fill("1500");
    await page
      .getByRole("button", { name: "قطع أو تصنيفات محددة", exact: true })
      .click();
    await page.getByLabel("اسم العرض", { exact: true }).fill("عرض الاختبار");
    await page.getByLabel("حتى تاريخ", { exact: true }).fill("2026-12-31");
    await page.getByRole("button", { name: "حفظ العرض", exact: true }).click();
    await page
      .getByRole("alert")
      .filter({ hasText: "اختاري قطعة أو تصنيفاً واحداً على الأقل." })
      .waitFor();
    await page.screenshot({
      path: "test-results/offer-form-desktop.png",
      fullPage: true,
    });
    await page.setViewportSize({ width: 390, height: 844 });
    assert.equal(
      await page
        .getByRole("dialog")
        .evaluate((el) => el.scrollWidth > el.clientWidth),
      false,
    );
    await page.screenshot({
      path: "test-results/offer-form-mobile.png",
      fullPage: true,
    });
    await page.keyboard.press("Escape");
    await page.setViewportSize({ width: 1440, height: 1050 });
    await page.goto(harnessUrl + "/?rentals#page=dresses");
    await page
      .getByRole("button", { name: "مين استأجرها؟", exact: true })
      .click();
    await page
      .getByText("عرائس مختلفات من نفس العنوان استأجرن هذه البدلة", {
        exact: true,
      })
      .waitFor();
    await page.getByText("سارة", { exact: true }).waitFor();
    await page.getByText("ريم", { exact: true }).waitFor();
    await page.getByPlaceholder("ابحثي باسم المستأجرة أو العنوان…").fill("ريم");
    assert.equal(await page.getByText("سارة", { exact: true }).count(), 0);
    await page
      .getByRole("button", { name: "فتح ملف الحجز #2", exact: true })
      .click();
    await page.getByRole("heading", { name: "ريم", exact: true }).waitFor();
    console.log(
      "PASS: single address field, price arrow/wheel guards, guided offer form, rental history and same-address indicator",
    );
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(harnessUrl);
    await page.getByRole("heading", { name: /أهلاً أرين/ }).waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "test-results/workspace-mobile.png",
      fullPage: true,
    });
    await page.getByRole("button", { name: "القائمة", exact: true }).click();
    await page
      .getByRole("navigation")
      .getByRole("button", { name: "مواعيد البروفا", exact: true })
      .click();
    await page
      .getByRole("heading", { name: "مواعيد البروفا", exact: true })
      .waitFor();
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "test-results/calendar-mobile.png",
      fullPage: true,
    });
    await page.goto(`http://localhost:${port}/login`);
    await page
      .getByRole("button", { name: "تثبيت التطبيق", exact: true })
      .click();
    await page
      .getByRole("dialog")
      .getByText(/Safari/)
      .waitFor();
    await page.keyboard.press("Escape");
    assert.equal(
      await page.evaluate(
        () => document.documentElement.scrollWidth > innerWidth,
      ),
      false,
    );
    await page.screenshot({
      path: "test-results/login-mobile.png",
      fullPage: true,
    });
    assert.deepEqual(errors, []);
    const manifest = await (
      await page.request.get(`http://localhost:${port}/manifest.webmanifest`)
    ).json();
    assert.equal(manifest.display, "standalone");
    for (const icon of manifest.icons) {
      const response = await page.request.get(
        `http://localhost:${port}${icon.src}`,
      );
      assert.ok(response.ok());
      assert.match(response.headers()["content-type"], /image\/png/);
    }
    await page.evaluate(async () => {
      await navigator.serviceWorker.ready;
      if (!navigator.serviceWorker.controller)
        await new Promise<void>((resolve) =>
          navigator.serviceWorker.addEventListener(
            "controllerchange",
            () => resolve(),
            { once: true },
          ),
        );
    });
    const cached = await page.evaluate(async () => {
      const cache = await caches.open("dressflow-public-v1");
      return (await cache.keys()).map((r) => new URL(r.url).pathname).sort();
    });
    assert.deepEqual(cached, ["/icons/icon-192.png", "/offline.html"]);
    await page.context().setOffline(true);
    await page.goto(`http://localhost:${port}/`);
    await page
      .getByRole("heading", { name: "الاتصال بالإنترنت غير متوفر" })
      .waitFor();
    await page.context().setOffline(false);
    console.log(
      "PASS: merged home, account fields, install instructions, manifest icons, service worker and offline fallback",
    );
    console.log(
      "PASS: mobile layout, drawer navigation, calendar, login, and zero browser runtime errors",
    );
  } finally {
    await browser.close();
    app.kill();
    harness.close();
  }
}
main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
