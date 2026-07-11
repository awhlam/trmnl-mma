const ESPN_SCOREBOARD = "https://site.api.espn.com/apis/site/v2/sports/mma/ufc/scoreboard";
const CACHE_SECONDS = 15 * 60;

function clamp(value, fallback, min, max) {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? Math.min(Math.max(parsed, min), max) : fallback;
}

function yyyymmdd(date) {
  return date.toISOString().slice(0, 10).replaceAll("-", "");
}

function validTimeZone(timeZone) {
  try {
    Intl.DateTimeFormat("en-US", { timeZone }).format();
    return timeZone;
  } catch {
    return "UTC";
  }
}

function formatDate(isoDate, timeZone) {
  const date = new Date(isoDate);
  return {
    date_label: new Intl.DateTimeFormat("en-US", {
      weekday: "short",
      month: "short",
      day: "numeric",
      timeZone,
    }).format(date),
    time_label: new Intl.DateTimeFormat("en-US", {
      hour: "numeric",
      minute: "2-digit",
      timeZone,
      timeZoneName: "short",
    }).format(date),
  };
}

export function normalizeEvent(event, timeZone) {
  const competition = event.competitions?.[0];
  const venue = event.venues?.[0] ?? competition?.venue;
  const city = venue?.address?.city;
  const region = venue?.address?.state ?? venue?.address?.country;
  const location = [city, region].filter(Boolean).join(", ");

  return {
    id: event.id,
    name: event.name ?? event.shortName ?? "UFC event",
    short_name: event.shortName ?? "UFC",
    starts_at: event.date,
    status: event.status?.type?.state ?? "pre",
    location: location || "Location TBA",
    ...formatDate(event.date, timeZone),
  };
}

export function selectEvents(events, now, timeZone, upcomingCount, recentCount) {
  const nowMs = now.getTime();
  const normalised = events
    .filter((event) => event?.date && Number.isFinite(Date.parse(event.date)))
    .map((event) => normalizeEvent(event, timeZone))
    .sort((a, b) => Date.parse(a.starts_at) - Date.parse(b.starts_at));

  return {
    // Keep an in-progress event visible, even if its first bout began a little earlier.
    upcoming: normalised
      .filter((event) => Date.parse(event.starts_at) >= nowMs - 6 * 60 * 60 * 1000)
      .slice(0, upcomingCount),
    recent: normalised
      .filter((event) => Date.parse(event.starts_at) < nowMs - 6 * 60 * 60 * 1000)
      .slice(-recentCount)
      .reverse(),
  };
}

export async function buildSchedule({ now = new Date(), timeZone = "UTC", upcomingCount = 4, recentCount = 1, fetchImpl = fetch } = {}) {
  const from = new Date(now);
  from.setUTCDate(from.getUTCDate() - 21);
  const to = new Date(now);
  to.setUTCDate(to.getUTCDate() + 120);

  const url = new URL(ESPN_SCOREBOARD);
  url.searchParams.set("limit", "100");
  url.searchParams.set("dates", `${yyyymmdd(from)}-${yyyymmdd(to)}`);

  const response = await fetchImpl(url, { headers: { Accept: "application/json" } });
  if (!response.ok) throw new Error(`ESPN schedule request failed (${response.status})`);

  const data = await response.json();
  return {
    league: "UFC",
    source: "ESPN",
    updated_at: now.toISOString(),
    timezone: timeZone,
    ...selectEvents(data.events ?? [], now, timeZone, upcomingCount, recentCount),
  };
}

export default {
  async fetch(request, _env, ctx) {
    const requestUrl = new URL(request.url);
    if (request.method !== "GET") return new Response("Method Not Allowed", { status: 405 });
    if (requestUrl.pathname === "/health") return Response.json({ ok: true });
    if (requestUrl.pathname !== "/events") return new Response("Not Found", { status: 404 });

    const timeZone = validTimeZone(requestUrl.searchParams.get("timezone") || "UTC");
    const upcomingCount = clamp(requestUrl.searchParams.get("upcoming"), 4, 1, 8);
    const recentCount = clamp(requestUrl.searchParams.get("recent"), 1, 0, 3);
    const cache = caches.default;
    const cacheKey = new Request(requestUrl.toString(), request);
    const cached = await cache.match(cacheKey);
    if (cached) return cached;

    try {
      const schedule = await buildSchedule({ timeZone, upcomingCount, recentCount });
      const response = Response.json(schedule, {
        headers: {
          "Cache-Control": `public, max-age=${CACHE_SECONDS}`,
          "Access-Control-Allow-Origin": "*",
        },
      });
      ctx.waitUntil(cache.put(cacheKey, response.clone()));
      return response;
    } catch (error) {
      return Response.json({ error: "Unable to load the UFC schedule", detail: error.message }, { status: 502 });
    }
  },
};
