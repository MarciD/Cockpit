// Capture tile / settings / page screenshots for every cockpit widget from an
// isolated dev server. Usage: node capture.mjs <baseUrl> <deskId> <outDir>
import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { join } from "node:path";

const [base = "http://localhost:4100", desk = "screenshots", out = "out"] =
  process.argv.slice(2);

const WIDGETS = [
  { id: "weather", title: "Weather" },
  { id: "news", title: "News" },
  { id: "todo", title: "To-do" },
  { id: "recurring-tasks", title: "Recurring Tasks" },
  { id: "custom-api", title: "Custom API" },
  { id: "gitlab-open-mrs", title: "Merge Requests" },
  { id: "jira-my-issues", title: "Jira Issues" },
  { id: "google-calendar-today", title: "Calendar" },
  { id: "ai-assistant", title: "Assistant" },
  {
    id: "language-learning",
    title: "Language",
    page: `/learn/Spanish?profile=${desk}&native=German`,
  },
];

const browser = await chromium.launch();
const context = await browser.newContext({
  viewport: { width: 1280, height: 900 },
  deviceScaleFactor: 2,
  locale: "en-GB",
  timezoneId: "Europe/Berlin",
});
const page = await context.newPage();

async function settle(ms = 2500) {
  await page.waitForLoadState("networkidle").catch(() => {});
  await page.waitForTimeout(ms);
}

function item(title) {
  return page
    .locator(".react-grid-item")
    .filter({ has: page.getByText(title, { exact: true }) })
    .first();
}

for (const w of WIDGETS) {
  const dir = join(out, w.id);
  mkdirSync(dir, { recursive: true });

  await page.goto(`${base}/${desk}`);
  await settle();
  const card = item(w.title);
  await card.scrollIntoViewIfNeeded();
  await card.screenshot({ path: join(dir, "tile.png") });

  // Settings: switch to Edit, open the gear, capture the modal panel.
  await page.getByRole("button", { name: "Edit", exact: true }).click();
  await card.getByRole("button", { name: "Widget settings" }).click();
  const title = page.getByText(`Configure — ${w.title}`, { exact: true });
  await title.waitFor();
  await page.waitForTimeout(600);
  await title
    .locator("xpath=..")
    .screenshot({ path: join(dir, "settings.png") });

  if (w.page) {
    await page.goto(`${base}${w.page}`);
    await settle();
    await page.screenshot({ path: join(dir, "page.png"), fullPage: true });
  }
  console.log("captured", w.id);
}

await browser.close();
