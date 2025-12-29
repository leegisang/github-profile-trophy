import "https://deno.land/x/dotenv@v0.5.0/load.ts";
import { GithubRepositoryService } from "../src/Repository/GithubRepository.ts";
import { GithubApiService } from "../src/Services/GithubApiService.ts";
import { staticRenderRegeneration } from "../src/StaticRenderRegeneration/index.ts";
import { ServiceError } from "../src/Types/index.ts";
import { Card } from "../src/card.ts";
import { cacheProvider } from "../src/config/cache.ts";
import { Error400 } from "../src/error_page.ts";
import { renderErrorSvg } from "../src/error_svg.ts";
import { ErrorPage } from "../src/pages/Error.ts";
import { COLORS, Theme } from "../src/theme.ts";
import { CONSTANTS, parseParams } from "../src/utils.ts";

// TypeScript tooling in some editors doesn't include Deno's global typings.
// Deno is provided at runtime by Vercel's deno runtime.
declare const Deno: { env: { get(key: string): string | undefined } };

const serviceProvider = new GithubApiService();
const client = new GithubRepositoryService(serviceProvider).repository;

// Build cache control header with optimized caching strategy
const cacheControlHeader = [
  "public",
  `max-age=${CONSTANTS.CACHE_MAX_AGE}`,
  `s-maxage=${CONSTANTS.CDN_CACHE_MAX_AGE}`,
  `stale-while-revalidate=${CONSTANTS.STALE_WHILE_REVALIDATE}`,
].join(", ");

const defaultHeaders = new Headers(
  {
    "Content-Type": "image/svg+xml",
    "Cache-Control": cacheControlHeader,
  },
);

export default (request: Request) =>
  staticRenderRegeneration(request, {
    revalidate: CONSTANTS.REVALIDATE_TIME,
    headers: defaultHeaders,
  }, function (req: Request) {
    return app(req);
  });

function isDebugEnabled(): boolean {
  return (Deno.env.get("DEBUG") ?? "").trim().toLowerCase() === "true";
}

function isTrueEnv(value: string | undefined): boolean {
  return (value ?? "").trim().toLowerCase() === "true";
}

function getPublicOrigin(req: Request): string {
  // Vercel provides x-forwarded-* headers; fall back to request.url.
  const url = new URL(req.url);
  const forwardedProto = req.headers.get("x-forwarded-proto");
  const forwardedHost = req.headers.get("x-forwarded-host");
  const host = (forwardedHost ?? req.headers.get("host") ?? url.host)
    .split(",")[0]
    .trim();
  const proto = (forwardedProto ?? url.protocol.replace(":", ""))
    .split(",")[0]
    .trim();
  return `${proto}://${host}`;
}

function isGithubImageProxy(req: Request): boolean {
  const ua = (req.headers.get("user-agent") ?? "").toLowerCase();
  return ua.includes("github-camo") || ua.includes("github") && ua.includes("image");
}

function isImageRequest(req: Request): boolean {
  const accept = (req.headers.get("accept") ?? "").toLowerCase();
  const fetchDest = (req.headers.get("sec-fetch-dest") ?? "").toLowerCase();
  return fetchDest === "image" || accept.includes("image/") || isGithubImageProxy(req);
}

function wantsHtml(req: Request): boolean {
  const accept = (req.headers.get("accept") ?? "").toLowerCase();
  // Only treat it as an HTML page if it's not an image request.
  return !isImageRequest(req) && accept.includes("text/html");
}

async function app(req: Request): Promise<Response> {
  const pathname = new URL(req.url).pathname;
  // Self-hosting hardening: only allow root requests.
  // Note: depending on the platform/router, the function may also be invoked on `/api`.
  if (pathname !== "/" && pathname !== "/api" && pathname !== "/api/") {
    return new Response("Not Found", {
      status: 404,
      headers: new Headers({
        "Content-Type": "text/plain; charset=utf-8",
        "Cache-Control": "no-store",
      }),
    });
  }

  const params = parseParams(req);
  const defaultUsername = Deno.env.get("DEFAULT_USERNAME")?.trim() || null;
  const forceDefaultUsername = isTrueEnv(Deno.env.get("FORCE_DEFAULT_USERNAME"));

  let username = params.get("username")?.trim() || null;
  if (forceDefaultUsername && defaultUsername) {
    username = defaultUsername;
  } else if (username === null && defaultUsername) {
    username = defaultUsername;
  }

  const row = params.getNumberValue("row", CONSTANTS.DEFAULT_MAX_ROW);
  const column = params.getNumberValue("column", CONSTANTS.DEFAULT_MAX_COLUMN);
  const themeParam: string = params.getStringValue("theme", "default");
  if (username === null) {
    const publicOrigin = getPublicOrigin(req);
    const base = `${publicOrigin}/`;
    const error = new Error400(
      `<section>
      <div>
        <h2>"username" is a required query parameter</h2>
        <p>The URL should look like
        <div>
          <p id="base-show">${base}?username=USERNAME</p>
          <button>Copy Base Url</button>
          <span id="temporary-span"></span>
        </div>where
        <code>USERNAME</code> is <em>your GitHub username.</em>
      </div>
      <div>
        <h2>You can use this form: </h2>
        <p>Enter your username and click get trophies</p>
        <form action="${base}" method="get">
          <label for="username">GitHub Username</label>
          <input type="text" name="username" id="username" placeholder="Ex. gabriel-logan" required>
          <label for="theme">Theme (Optional)</label>
          <input type="text" name="theme" id="theme" placeholder="Ex. onedark" value="light">
          <text>
            See all the available themes
            <a href="https://github.com/ryo-ma/github-profile-trophy?tab=readme-ov-file#apply-theme" target="_blank">here</a>
          </text>
          <br>
          <button type="submit">Get Trophy&apos;s</button>
        </form>
      </div>
      <script>
        const base = "${base}";
        const button = document.querySelector("button");
        const input = document.querySelector("input");
        const temporarySpan = document.querySelector("#temporary-span");

        button.addEventListener("click", () => {
          navigator.clipboard.writeText(document.querySelector("#base-show").textContent);
          temporarySpan.textContent = "Copied!";
          setTimeout(() => {
            temporarySpan.textContent = "";
          }, 1500);
        });
      </script>
    </section>`,
    );
    return new Response(
      error.render(),
      {
        status: error.status,
        headers: new Headers({
          "Content-Type": "text/html; charset=utf-8",
          "Cache-Control": cacheControlHeader,
        }),
      },
    );
  }
  let theme: Theme = COLORS.default;
  if (Object.keys(COLORS).includes(themeParam)) {
    theme = COLORS[themeParam];
  }
  const marginWidth = params.getNumberValue(
    "margin-w",
    CONSTANTS.DEFAULT_MARGIN_W,
  );
  const paddingHeight = params.getNumberValue(
    "margin-h",
    CONSTANTS.DEFAULT_MARGIN_H,
  );
  const noBackground = params.getBooleanValue(
    "no-bg",
    CONSTANTS.DEFAULT_NO_BACKGROUND,
  );
  const noFrame = params.getBooleanValue(
    "no-frame",
    CONSTANTS.DEFAULT_NO_FRAME,
  );
  const titles: Array<string> = params.getAll("title").flatMap((r) =>
    r.split(",")
  ).map((r) => r.trim());
  const ranks: Array<string> = params.getAll("rank").flatMap((r) =>
    r.split(",")
  ).map((r) => r.trim());

  const userKeyCache = ["v1", username].join("-");
  const userInfoCached = await cacheProvider.get(userKeyCache) || "{}";
  let userInfo = JSON.parse(userInfoCached);
  const hasCache = !!Object.keys(userInfo).length;

  if (!hasCache) {
    const userResponseInfo = await client.requestUserInfo(username);
    if (userResponseInfo instanceof ServiceError) {
      const hasGithubToken = !!(Deno.env.get("GITHUB_TOKEN1")?.trim());
      const contextHtml = isDebugEnabled()
        ? `<div><strong>Debug</strong><br/>username: <code>${username}</code><br/>GITHUB_TOKEN1 set: <code>${hasGithubToken}</code></div>` +
        `<div>Tips: verify the username exists at <code>https://github.com/${username}</code>. If token is missing/invalid, set <code>GITHUB_TOKEN1</code> in Vercel (Production) and redeploy.</div>`
        : undefined;
      if (isImageRequest(req)) {
        const lines: string[] = [];
        lines.push(`username: ${username}`);
        if (userResponseInfo.code === 401) {
          lines.push("GitHub API auth failed. Check GITHUB_TOKEN1.");
        } else if (userResponseInfo.code === 419) {
          lines.push("GitHub API rate limit exceeded. Try later.");
        } else {
          lines.push("User not found or GitHub API error.");
        }
        if (isDebugEnabled()) {
          lines.push(`GITHUB_TOKEN1 set: ${hasGithubToken}`);
        }
        return new Response(
          renderErrorSvg(`${userResponseInfo.code} - ${userResponseInfo.name}`, lines),
          {
            // GitHub README treats non-2xx as a broken image; return 200 with an error SVG instead.
            status: 200,
            headers: new Headers({
              "Content-Type": "image/svg+xml; charset=utf-8",
              "Cache-Control": "no-store",
            }),
          },
        );
      }
      return new Response(
        ErrorPage({ error: userResponseInfo, contextHtml }).render(),
        {
          status: userResponseInfo.code,
          headers: new Headers({
            "Content-Type": "text/html; charset=utf-8",
            "Cache-Control": "no-store",
          }),
        },
      );
    }
    userInfo = userResponseInfo;
    await cacheProvider.set(userKeyCache, JSON.stringify(userInfo));
  }
  // Success Response
  return new Response(
    new Card(
      titles,
      ranks,
      column,
      row,
      CONSTANTS.DEFAULT_PANEL_SIZE,
      marginWidth,
      paddingHeight,
      noBackground,
      noFrame,
    ).render(userInfo, theme),
    {
      headers: defaultHeaders,
    },
  );
}
