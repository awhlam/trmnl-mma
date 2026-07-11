import assert from "node:assert/strict";
import test from "node:test";
import { buildSchedule, selectEvents } from "../src/worker.js";

const NOW = new Date("2026-07-11T12:00:00Z");

test("selectEvents keeps upcoming events ordered and the newest recent event", () => {
  const events = [
    { id: "old", name: "UFC Old", date: "2026-07-01T20:00:00Z" },
    { id: "next", name: "UFC Next", date: "2026-07-20T20:00:00Z" },
    { id: "live", name: "UFC Live", date: "2026-07-11T09:00:00Z" },
    { id: "later", name: "UFC Later", date: "2026-08-01T20:00:00Z" },
  ];

  const result = selectEvents(events, NOW, "America/Los_Angeles", 2, 1);
  assert.deepEqual(result.upcoming.map((event) => event.id), ["live", "next"]);
  assert.deepEqual(result.recent.map((event) => event.id), ["old"]);
  assert.equal(result.upcoming[1].date_label, "Mon, Jul 20");
});

test("buildSchedule requests a bounded ESPN date range and normalizes the response", async () => {
  let requestedUrl;
  const fetchImpl = async (url) => {
    requestedUrl = new URL(url);
    return new Response(JSON.stringify({
      events: [{ id: "123", name: "UFC Test", date: "2026-07-18T20:00:00Z" }],
    }));
  };

  const result = await buildSchedule({ now: NOW, timeZone: "UTC", fetchImpl });
  assert.equal(requestedUrl.searchParams.get("dates"), "20260620-20261108");
  assert.equal(result.upcoming[0].name, "UFC Test");
  assert.equal(result.recent.length, 0);
});
