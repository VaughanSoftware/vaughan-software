# Vaughan Software — website

A fast, responsive static site built with plain HTML, CSS and JavaScript. A tiny zero-dependency Node script stitches shared partials (header, footer, etc.) into each page and outputs plain HTML to `dist/`, ready for GitHub Pages, Netlify, Cloudflare Pages or any static host.

## Quick start

Requires Node.js 18+ (20+ for the dev server's file watching). No `npm install` needed.

```bash
npm run dev     # build + serve at http://localhost:8080, rebuilds on change
npm run build   # build to dist/
```

## Structure

```
site.config.json      Site name, URL, base path, email, default description
build.js              Static site builder (no dependencies)
serve.js              Local dev server with auto-rebuild
src/
  partials/           Shared HTML: layout, header, footer, cta
  pages/              One file per page -> dist/<name>/index.html (clean URLs)
  assets/             CSS, JS, images (copied as-is)
tools/
  generate-images.html  Draws the share image and app icon
```

### Templating

- `{{> name }}` includes `src/partials/name.html`
- `{{ var }}` outputs a variable: `title`, `description`, `base`, `canonical`, `year`, `slug`, and any `site.*` key from `site.config.json`
- Each page starts with front matter:

  ```
  ---
  title: Services            # becomes "Services — Vaughan Software"; keep under ~45 chars
  description: Shown in search results (aim for 120–160 characters).
  breadcrumb: Services       # optional short name used in breadcrumb structured data
  type: AboutPage            # optional schema.org page type (default WebPage)
  robots: noindex            # optional: hide from search engines and the sitemap
  ---
  ```

  Add `sitemap: false` to exclude a page from `sitemap.xml`.

- Nav links with `data-nav="<page>"` automatically get `aria-current="page"` on that page.

To add a page: create `src/pages/new-page.html` with front matter, and add a link in `src/partials/header.html`.

The build also generates `sitemap.xml`, `robots.txt`, `site.webmanifest` and `.nojekyll`.

## SEO

Handled automatically by the build:

- Unique `<title>`, meta description, canonical URL and `robots` tag per page (the 404 page is `noindex`)
- Open Graph and Twitter/X card tags with a 1200×630 share image (`src/assets/img/og-image.jpg`)
- schema.org JSON-LD: `ProfessionalService` (services, skills, area served), `WebSite`, page type and breadcrumbs. On the Services page, the FAQ is also output as `FAQPage`.
  - Any `<details class="faq-item"><summary>Question</summary>Answer</details>` on a page is picked up automatically.
- `sitemap.xml` with last-modified dates (from git history if available), referenced from `robots.txt`
- `lang="en-GB"`, Apple touch icon and web manifest

Settings in `site.config.json`:

- `description`, `knowsAbout`, `services`, `areaServed` feed the structured data.
- `sameAs` — add your profile URLs (LinkedIn, GitHub, etc.). This helps search engines connect them to the business.
- `googleSiteVerification` / `bingSiteVerification` — paste the verification codes from Search Console / Bing Webmaster Tools.

To change the share image or app icon, open `tools/generate-images.html` in a browser, tweak the drawing code if needed, and download the files into `src/assets/img/`.

After launch:

1. Verify the site in [Google Search Console](https://search.google.com/search-console) and [Bing Webmaster Tools](https://www.bing.com/webmasters), then submit `sitemap.xml`.
2. Check pages with Google's [Rich Results Test](https://search.google.com/test/rich-results) and [PageSpeed Insights](https://pagespeed.web.dev/).
3. Create a free Google Business Profile (as a service-area business, so no public address is needed) and link it to the site.
4. Get links from your profiles and listings: LinkedIn, GitHub, the WordPress.org profile, freelancer directories, and client sites (a "built by" footer link).

## Deploying to GitHub Pages (free)

1. Push this folder to a GitHub repository (branch `main`).
2. In the repo go to **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. Every push to `main` builds and deploys via `.github/workflows/deploy.yml`.

Update `site.config.json`:

- `url` — your live URL (used for canonical links and the sitemap), e.g. `https://username.github.io/repo` or `https://vaughansoftware.com`.
- `basePath` — the path the site is served from. `/` for a custom domain or `username.github.io` repo; `/repo-name/` for a project site.
- `customDomain` — leave empty until your custom domain's DNS is pointed at GitHub and you are ready to enable it. The build writes the required `CNAME` file when this is set.

**Custom domain:** point your DNS at GitHub first. Then set `url` to `https://vaughan-software.com`, `basePath` to `/`, and `customDomain` to `vaughan-software.com`; push the change and set the same domain in **Settings → Pages → Custom domain** (works with the Actions deploy).

For `vaughan-software.com` managed in Cloudflare, add these DNS-only records (leave the proxy disabled / gray cloud; proxied Cloudflare records can interfere with GitHub's domain verification and HTTPS certificate setup):

| Type | Name | Target |
| --- | --- | --- |
| A | `@` | `185.199.108.153` |
| A | `@` | `185.199.109.153` |
| A | `@` | `185.199.110.153` |
| A | `@` | `185.199.111.153` |
| CNAME | `www` | `vaughansoftware.github.io` |

Then set `vaughan-software.com` as the custom domain in **GitHub repository → Settings → Pages**, wait for DNS verification and the HTTPS certificate to become available, and enable **Enforce HTTPS**. DNS changes can take time to propagate.

Pages use clean paths without file extensions, such as `/services` and `/about`. Both slashless and trailing-slash paths serve the page; the slashless path is canonical.

## Other free hosts

Any static host works — set the build command to `node build.js` and output directory to `dist`:

- **Cloudflare Pages** / **Netlify** / **Vercel** — connect the repo, use the settings above.

## Contact form

The site has no backend, so the contact form opens the visitor's email app with a pre-filled message. To receive submissions directly instead, point the form at a free service such as Formspree or Web3Forms by adding `action="..." method="POST"` to the form and removing the `data-contact-form` attribute.
