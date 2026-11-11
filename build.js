#!/usr/bin/env node
// Zero-dependency static site builder: src/pages/*.html + src/partials -> dist/
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const ROOT = __dirname;
const SRC = path.join(ROOT, 'src');
const OUT = path.join(ROOT, 'dist');
const config = JSON.parse(fs.readFileSync(path.join(ROOT, 'site.config.json'), 'utf8'));

function parseFrontMatter(raw) {
  const match = raw.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?/);
  if (!match) return { meta: {}, body: raw };
  const meta = {};
  for (const line of match[1].split(/\r?\n/)) {
    const i = line.indexOf(':');
    if (i > 0) meta[line.slice(0, i).trim()] = line.slice(i + 1).trim();
  }
  return { meta, body: raw.slice(match[0].length) };
}

function loadPartials() {
  const dir = path.join(SRC, 'partials');
  const partials = {};
  for (const file of fs.readdirSync(dir)) {
    if (file.endsWith('.html')) partials[path.basename(file, '.html')] = fs.readFileSync(path.join(dir, file), 'utf8');
  }
  return partials;
}

function render(template, vars, partials, depth = 0) {
  if (depth > 10) throw new Error('Partial nesting too deep');
  let out = template.replace(/\{\{>\s*([\w-]+)\s*\}\}/g, (_, name) => {
    if (!(name in partials)) throw new Error(`Unknown partial: ${name}`);
    return render(partials[name], vars, partials, depth + 1);
  });
  out = out.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (m, key) => (key in vars ? vars[key] : m));
  return out;
}

function copyDir(from, to) {
  fs.mkdirSync(to, { recursive: true });
  for (const entry of fs.readdirSync(from, { withFileTypes: true })) {
    const s = path.join(from, entry.name);
    const d = path.join(to, entry.name);
    entry.isDirectory() ? copyDir(s, d) : fs.copyFileSync(s, d);
  }
}

const escapeHtml = (s) =>
  String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const stripTags = (s) => s.replace(/<[^>]+>/g, '').replace(/\s+/g, ' ').trim();

// Last modified date for the sitemap: git commit date if available, else file mtime.
function lastModified(file) {
  try {
    const out = execSync(`git log -1 --format=%cs -- "${file}"`, { cwd: ROOT, stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (out) return out;
  } catch {}
  return fs.statSync(file).mtime.toISOString().slice(0, 10);
}

// Builds schema.org JSON-LD for a page (business, website, webpage, breadcrumbs, FAQ).
function structuredData({ slug, meta, title, description, canonical, siteUrl, body }) {
  const home = `${siteUrl}/`;
  const businessId = `${home}#business`;
  const websiteId = `${home}#website`;
  const graph = [
    {
      '@type': 'ProfessionalService',
      '@id': businessId,
      name: config.name,
      url: home,
      email: config.email,
      description: config.description,
      logo: `${home}${config.logo}`,
      image: `${home}${config.ogImage}`,
      areaServed: config.areaServed,
      knowsAbout: config.knowsAbout,
      ...(config.sameAs.length ? { sameAs: config.sameAs } : {}),
      hasOfferCatalog: {
        '@type': 'OfferCatalog',
        name: 'Web development services',
        itemListElement: config.services.map((s) => ({
          '@type': 'Offer',
          itemOffered: { '@type': 'Service', name: s.name, description: s.description, provider: { '@id': businessId } },
        })),
      },
    },
    { '@type': 'WebSite', '@id': websiteId, url: home, name: config.name, inLanguage: config.lang, publisher: { '@id': businessId } },
  ];

  const webpage = {
    '@type': meta.type || 'WebPage',
    '@id': `${canonical}#webpage`,
    url: canonical,
    name: title,
    description,
    inLanguage: config.lang,
    isPartOf: { '@id': websiteId },
    about: { '@id': businessId },
  };
  if (slug !== 'index') {
    webpage.breadcrumb = {
      '@type': 'BreadcrumbList',
      itemListElement: [
        { '@type': 'ListItem', position: 1, name: 'Home', item: home },
        { '@type': 'ListItem', position: 2, name: meta.breadcrumb || meta.title, item: canonical },
      ],
    };
  }
  graph.push(webpage);

  const faqs = [...body.matchAll(/<details class="faq-item"[^>]*>\s*<summary>([\s\S]*?)<\/summary>([\s\S]*?)<\/details>/g)];
  if (faqs.length) {
    graph.push({
      '@type': 'FAQPage',
      '@id': `${canonical}#faq`,
      isPartOf: { '@id': `${canonical}#webpage` },
      mainEntity: faqs.map(([, q, a]) => ({
        '@type': 'Question',
        name: stripTags(q),
        acceptedAnswer: { '@type': 'Answer', text: stripTags(a) },
      })),
    });
  }

  // Escape "<" so content can never close the script tag
  return JSON.stringify({ '@context': 'https://schema.org', '@graph': graph }, null, 2).replace(/</g, '\\u003c');
}

function verificationTags() {
  const tags = [];
  if (config.googleSiteVerification) tags.push(`<meta name="google-site-verification" content="${escapeHtml(config.googleSiteVerification)}">`);
  if (config.bingSiteVerification) tags.push(`<meta name="msvalidate.01" content="${escapeHtml(config.bingSiteVerification)}">`);
  return tags.join('\n  ');
}

function build() {
  const started = Date.now();
  fs.rmSync(OUT, { recursive: true, force: true });
  fs.mkdirSync(OUT, { recursive: true });

  const partials = loadPartials();
  const pagesDir = path.join(SRC, 'pages');
  const siteUrl = config.url.replace(/\/$/, '');
  const sitemap = [];

  for (const file of fs.readdirSync(pagesDir).filter((f) => f.endsWith('.html'))) {
    const slug = path.basename(file, '.html');
    const srcFile = path.join(pagesDir, file);
    const { meta, body } = parseFrontMatter(fs.readFileSync(srcFile, 'utf8'));
    const is404 = slug === '404';
    const pagePath = slug === 'index' ? '' : `${slug}.html`;
    const title = meta.title ? `${meta.title} — ${config.name}` : config.name;
    const description = meta.description || config.description;
    const canonical = `${siteUrl}/${pagePath}`;

    const vars = {
      ...Object.fromEntries(
        Object.entries(config)
          .filter(([, v]) => typeof v === 'string')
          .map(([k, v]) => [`site.${k}`, escapeHtml(v)])
      ),
      title: escapeHtml(title),
      description: escapeHtml(description),
      slug,
      // 404 is served from arbitrary URLs, so it needs absolute asset paths
      base: is404 ? config.basePath : './',
      canonical,
      siteUrl,
      robots: is404 || meta.robots === 'noindex' ? 'noindex, follow' : 'index, follow, max-image-preview:large',
      ogImage: `${siteUrl}/${config.ogImage}`,
      verification: verificationTags(),
      schema: structuredData({ slug, meta, title, description, canonical, siteUrl, body }),
      year: String(new Date().getFullYear()),
    };
    vars.content = render(body, vars, partials);

    let html = render(partials.layout, vars, partials);
    html = html.replace(new RegExp(`data-nav="${slug}"`, 'g'), `data-nav="${slug}" aria-current="page"`);
    fs.writeFileSync(path.join(OUT, file), html);
    if (!is404 && meta.sitemap !== 'false' && meta.robots !== 'noindex') {
      sitemap.push({ loc: canonical, lastmod: lastModified(srcFile), priority: slug === 'index' ? '1.0' : '0.8' });
    }
  }

  copyDir(path.join(SRC, 'assets'), path.join(OUT, 'assets'));
  sitemap.sort((a, b) => b.priority.localeCompare(a.priority));

  fs.writeFileSync(
    path.join(OUT, 'sitemap.xml'),
    `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${sitemap
      .map((u) => `  <url><loc>${u.loc}</loc><lastmod>${u.lastmod}</lastmod><priority>${u.priority}</priority></url>`)
      .join('\n')}\n</urlset>\n`
  );
  fs.writeFileSync(
    path.join(OUT, 'site.webmanifest'),
    JSON.stringify(
      {
        name: config.name,
        short_name: config.name,
        start_url: config.basePath,
        display: 'browser',
        background_color: '#0b0d12',
        theme_color: '#0b0d12',
        icons: [
          { src: `${config.basePath}assets/img/favicon.svg`, sizes: 'any', type: 'image/svg+xml' },
          { src: `${config.basePath}assets/img/apple-touch-icon.png`, sizes: '180x180', type: 'image/png' },
        ],
      },
      null,
      2
    )
  );
  fs.writeFileSync(path.join(OUT, 'robots.txt'), `User-agent: *\nAllow: /\nSitemap: ${siteUrl}/sitemap.xml\n`);
  fs.writeFileSync(path.join(OUT, '.nojekyll'), '');

  console.log(`Built ${sitemap.length} indexable pages (+404) to dist/ in ${Date.now() - started}ms`);
}

module.exports = build;
if (require.main === module) build();
