const SHORTENERS = ["is.gd", "v.gd"];

function jsonResponse(payload, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      "Content-Type": "application/json; charset=utf-8",
      "Cache-Control": "no-store"
    }
  });
}

export async function onRequestPost({ request }) {
  let body;
  try {
    body = await request.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON request." }, 400);
  }

  let target;
  try {
    target = new URL(String(body && body.url || ""));
  } catch {
    return jsonResponse({ error: "Please provide a valid page URL." }, 400);
  }

  const siteOrigin = new URL(request.url).origin;
  if (target.protocol !== "https:" || target.origin !== siteOrigin) {
    return jsonResponse({ error: "Only HTTPS links from this website can be shortened." }, 400);
  }

  if (target.href.length > 5000) {
    return jsonResponse({ error: "This link is too long to shorten." }, 400);
  }

  const errors = [];
  for (const host of SHORTENERS) {
    try {
      const endpoint = new URL("https://" + host + "/create.php");
      endpoint.searchParams.set("format", "json");
      endpoint.searchParams.set("url", target.href);

      const upstream = await fetch(endpoint.toString(), {
        headers: { "Accept": "application/json" },
        signal: AbortSignal.timeout(8000)
      });
      const data = await upstream.json();

      if (upstream.ok && data && typeof data.shorturl === "string") {
        const shortUrl = new URL(data.shorturl);
        if (shortUrl.protocol === "https:" && shortUrl.hostname === host) {
          return jsonResponse({ shorturl: shortUrl.href });
        }
      }

      errors.push(host + ": " + String(data && data.errormessage || "The service returned no short URL."));
    } catch (error) {
      errors.push(host + ": " + String(error && error.message || "Request failed."));
    }
  }

  return jsonResponse({
    error: "Both short-link providers failed. " + errors.join(" ")
  }, 502);
}
