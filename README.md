# TRMNL MMA

An installable MVP for showing upcoming UFC events on a TRMNL. It uses a **TRMNL Private Plugin** with the Polling strategy and a small [Cloudflare Worker](https://workers.cloudflare.com/) that converts ESPN's public UFC schedule into a compact, screen-friendly JSON response.

## What it shows

- The next four UFC events, ordered by start time
- Local date/time based on the TRMNL account's configured time zone
- City/region when ESPN supplies it
- An in-progress event labelled `LIVE`
- The most recent event (optional footer)

The Worker deliberately reads no user data and needs no secret or API key.

## Deploy the schedule endpoint

Prerequisites: a Cloudflare account and Node.js 18+.

```powershell
npx wrangler login
npx wrangler deploy
```

Cloudflare will print a URL such as `https://trmnl-mma.example.workers.dev`. Confirm it works by opening:

```
https://trmnl-mma.example.workers.dev/events?timezone=America%2FLos_Angeles
```

The response includes `upcoming` and `recent` arrays. Responses are cached for 15 minutes to avoid needless calls to ESPN.

## Install on TRMNL

This uses the fast, personal-install path; it does not require creating a public Marketplace OAuth client.

1. In TRMNL, go to **Plugins** and add **Private Plugin**. A Developer add-on or BYOD licence is required for Private Plugins.
2. Give it a name such as `UFC Schedule`, choose **Polling**, and set the polling verb to **GET**.
3. Set the Polling URL to the following, replacing the Worker host with yours:

   ```text
   https://trmnl-mma.<your-subdomain>.workers.dev/events?timezone=##{{ trmnl.user.time_zone_iana | url_encode }}
   ```

   `##{{ ... }}` is TRMNL's documented way of writing a Liquid variable in its help articles. Enter the variable exactly as shown in the TRMNL editor; it passes the installed user's IANA time zone to the endpoint.
4. Save the plugin, click **Edit Markup**, and paste [trmnl/shared.html](trmnl/shared.html) into the **Shared** tab and [trmnl/markup-full.html](trmnl/markup-full.html) into the **Full screen** tab.
5. Click **Force Refresh** to preview it, then add it to your device playlist. Choose a refresh interval of 30–60 minutes.
6. For a left/right mashup, also paste [trmnl/markup-half-vertical.html](trmnl/markup-half-vertical.html) into the matching layout tab.

## Develop locally

```powershell
npm test
npx wrangler dev
```

The public ESPN endpoint is intentionally isolated in `src/worker.js`. If its payload changes, only the normalisation logic needs updating. This is an MVP data source, not an official UFC feed.

## Next improvements

- Add other promotions (PFL, ONE, Bellator) as separate source adapters.
- Add a setting for number of events and whether to show the recent-event footer.
- Use a licensed/official event feed before publishing publicly, and submit the finished Private Plugin as a TRMNL Recipe.
