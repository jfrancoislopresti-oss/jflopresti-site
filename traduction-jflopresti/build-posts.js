/* =====================================================================
   build-posts.js — lancé par Cloudflare Pages à chaque mise à jour
   1. Génère une page HTML par article (posts/<slug>/index.html)
   2. Écrit posts/index.json (liste des articles publiés)
   3. Insère la liste des articles EN HTML STATIQUE dans l'accueil et
      dans /blog/ (entre <!-- POSTS:START --> et <!-- POSTS:END -->),
      pour que Google voie les liens sans exécuter de JavaScript
   4. Régénère sitemap.xml (pages + pages locales + articles)
   ===================================================================== */
const fs = require('fs');
const path = require('path');

const SITE = 'https://jflopresti.fr';
const PHONE = '06 46 63 40 73';
const PHONE_TEL = '+33646634073';
const OG_IMAGE = SITE + '/og-image.png';
const postsDir = path.join(__dirname, 'posts');
const outputFile = path.join(postsDir, 'index.json');
const TODAY = new Date().toISOString().slice(0, 10);

// Pages fixes du site (pour le sitemap). Ajouter ici toute nouvelle page.
const STATIC_PAGES = [
  ['/', '1.0', 'weekly'],
  ['/creation-site/', '0.9', 'monthly'],
  ['/attirer-visiteurs/', '0.9', 'monthly'],
  ['/conversion/', '0.9', 'monthly'],
  ['/formation-reseaux-sociaux/', '0.9', 'monthly'],
  ['/abonnement/', '0.8', 'monthly'],
  ['/creation-site-web-manosque/', '0.9', 'monthly'],
  ['/creation-site-web-forcalquier/', '0.8', 'monthly'],
  ['/creation-site-web-oraison/', '0.8', 'monthly'],
  ['/creation-site-web-digne-les-bains/', '0.8', 'monthly'],
  ['/creation-site-web-sisteron/', '0.8', 'monthly'],
  ['/creation-site-web-pertuis/', '0.8', 'monthly'],
  ['/blog/', '0.8', 'weekly'],
];

const esc = s => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function parseFrontMatter(content) {
  content = content.replace(/\r\n/g, '\n');
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  const lines = match[1].split('\n');
  let currentKey = null;
  let currentVal = [];
  lines.forEach(line => {
    const colonIdx = line.indexOf(':');
    if (colonIdx > 0 && !line.startsWith(' ') && !line.startsWith('\t')) {
      if (currentKey) meta[currentKey] = currentVal.join(' ').trim().replace(/^["']|["']$/g, '');
      currentKey = line.slice(0, colonIdx).trim();
      currentVal = [line.slice(colonIdx + 1).trim()];
    } else if (currentKey) {
      currentVal.push(line.trim());
    }
  });
  if (currentKey) meta[currentKey] = currentVal.join(' ').trim().replace(/^["']|["']$/g, '');
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');
  return { meta, body };
}

function mdToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h2>$1</h2>') // un seul H1 par page : le titre de l'article
    .replace(/!\[(.*?)\]\((.+?)\)/g, '<img src="$2" alt="$1" loading="lazy">')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .split('\n').filter(l => l.trim())
    .map(l => l.match(/^<(h[23]|ul|li|img)/) ? l : `<p>${l}</p>`).join('\n');
}

// "16/07/2026" -> "2026-07-16" (sinon date du nom de fichier)
function isoDate(d, filename) {
  const m = String(d || '').match(/^(\d{2})\/(\d{2})\/(\d{4})/);
  if (m) return `${m[3]}-${m[2]}-${m[1]}`;
  if (/^\d{4}-\d{2}-\d{2}/.test(d || '')) return d.slice(0, 10);
  const f = filename.match(/^(\d{4}-\d{2}-\d{2})/);
  return f ? f[1] : TODAY;
}

const LOGO_SVG = `<svg width="40" height="40" viewBox="0 0 80 80" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="JFL — accueil" style="display:block;"><defs><linearGradient id="jflg" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="#E8541A"/><stop offset="100%" stop-color="#1B3A5C"/></linearGradient></defs><rect width="80" height="80" rx="6" fill="url(#jflg)"/><text x="40" y="53" font-family="Arial Black, Arial, sans-serif" font-weight="900" font-size="30" fill="#fff" text-anchor="middle" letter-spacing="-1">JFL</text></svg>`;

const SITE_FOOTER = `<footer class="site-footer">
  <div class="sf-grid">
    <div>
      <div class="sf-logo">Jean-François Lopresti</div>
      <p>Consultant en présence digitale basé à Manosque (04). Création de site web, référencement Google local, animation et formation réseaux sociaux pour les artisans, commerçants et indépendants des Alpes-de-Haute-Provence et de la région PACA.</p>
      <p><a class="sf-tel" href="tel:${PHONE_TEL}">${PHONE}</a><br><a href="mailto:contact@jflopresti.fr">contact@jflopresti.fr</a><br>Manosque, Alpes-de-Haute-Provence</p>
    </div>
    <div class="sf-col" role="navigation" aria-label="Services"><div class="sf-t">Services</div><ul><li><a href="/creation-site/">Création de site web</a></li><li><a href="/attirer-visiteurs/">Référencement Google local</a></li><li><a href="/conversion/">Amélioration de site web</a></li><li><a href="/formation-reseaux-sociaux/">Formation réseaux sociaux</a></li><li><a href="/abonnement/">Gestion site &amp; réseaux sociaux</a></li><li><a href="/blog/">Blog &amp; conseils</a></li></ul></div>
    <div class="sf-col" role="navigation" aria-label="Zone d'intervention"><div class="sf-t">Où j'interviens</div><ul><li><a href="/creation-site-web-manosque/">Site internet &amp; SEO à Manosque</a></li><li><a href="/creation-site-web-forcalquier/">Site internet &amp; SEO à Forcalquier</a></li><li><a href="/creation-site-web-oraison/">Site internet &amp; SEO à Oraison</a></li><li><a href="/creation-site-web-digne-les-bains/">Site internet &amp; SEO à Digne-les-Bains</a></li><li><a href="/creation-site-web-sisteron/">Site internet &amp; SEO à Sisteron</a></li><li><a href="/creation-site-web-pertuis/">Site internet &amp; SEO à Pertuis</a></li></ul></div>
  </div>
  <div class="sf-bottom"><span>© ${new Date().getFullYear()} Jean-François Lopresti</span><a href="/#contact">Demander un diagnostic gratuit →</a></div>
</footer>`;

const SITE_FOOTER_CSS = `.site-footer{position:relative;z-index:1;border-top:1.5px solid var(--border);background:#fff;padding:3rem 4rem 1.5rem;}
.sf-grid{max-width:1100px;margin:0 auto;display:grid;grid-template-columns:1.3fr 1fr 1fr;gap:2.5rem;}
.sf-logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:#1B3A5C;margin-bottom:.6rem;}
.sf-grid p{font-size:.85rem;color:#595959;line-height:1.7;margin-bottom:.8rem;}
.sf-t{font-size:.75rem;font-weight:700;letter-spacing:.12em;text-transform:uppercase;color:#E8541A;margin-bottom:.8rem;}
.sf-grid ul{list-style:none;}.sf-grid li{margin-bottom:.45rem;}
.sf-grid a{font-size:.88rem;color:#3A3A3A;text-decoration:none;}.sf-grid a:hover{color:#E8541A;}
.sf-tel{font-weight:700;color:#1B3A5C!important;font-size:1rem!important;}
.sf-bottom{max-width:1100px;margin:2rem auto 0;padding-top:1.2rem;border-top:1px solid #E5E3DF;font-size:.8rem;color:#595959;display:flex;justify-content:space-between;flex-wrap:wrap;gap:.8rem;}
.sf-bottom a{color:#595959;}
.local-cta{margin-top:3rem;padding:2rem;border:1.5px solid var(--border);border-top:3px solid var(--accent);background:rgba(255,255,255,.9);border-radius:4px;}
.local-cta h2{font-family:'Syne',sans-serif;font-size:1.2rem;color:#1B3A5C;margin-bottom:.7rem;}
.local-cta p{font-size:.92rem;color:#3A3A3A;line-height:1.8;margin-bottom:.8rem;}
.local-cta a{color:var(--accent);font-weight:600;text-decoration:none;}
@media(max-width:900px){.site-footer{padding:2.5rem 1.5rem 1.5rem;}.sf-grid{grid-template-columns:1fr;gap:1.8rem;}}`;

const files = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'))
  .sort().reverse();

const articles = files.map(filename => {
  const content = fs.readFileSync(path.join(postsDir, filename), 'utf8');
  const { meta, body } = parseFrontMatter(content);
  const published = meta.published !== 'false';
  const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace('.md', '');
  const url = `/posts/${slug}/`;
  const fullUrl = SITE + url;
  const cover = meta.cover || null;
  const emoji = meta.emoji || '📝';
  const title = meta.title || 'Article';
  const excerpt = meta.excerpt || '';
  const dateIso = isoDate(meta.date, filename);
  const image = cover ? SITE + encodeURI(cover) : OG_IMAGE;

  // Lien vers le formulaire selon la catégorie
  const categoryToSituation = {
    'Être visible sur Google': 'visibilite',
    'Améliorer son site': 'conversion',
    'Trouver des clients': 'creation',
    'Développer son activité': 'creation',
    'Réseaux sociaux': 'formation'
  };
  const situation = categoryToSituation[meta.category] || 'diagnostic';
  const contactUrl = `/?situation=${situation}#contact`;

  if (!published) return null; // un brouillon ne génère pas de page publique

  const articleLd = {
    '@context': 'https://schema.org', '@type': 'BlogPosting',
    headline: title, description: excerpt, image: image,
    datePublished: dateIso, dateModified: dateIso,
    inLanguage: 'fr-FR', mainEntityOfPage: fullUrl,
    author: { '@type': 'Person', name: 'Jean-François Lopresti', url: SITE + '/' },
    publisher: { '@type': 'Organization', name: 'Jean-François Lopresti — Présence digitale', url: SITE + '/', logo: { '@type': 'ImageObject', url: OG_IMAGE } }
  };
  const breadcrumbLd = {
    '@context': 'https://schema.org', '@type': 'BreadcrumbList', itemListElement: [
      { '@type': 'ListItem', position: 1, name: 'Accueil', item: SITE + '/' },
      { '@type': 'ListItem', position: 2, name: 'Blog', item: SITE + '/blog/' },
      { '@type': 'ListItem', position: 3, name: title, item: fullUrl }]
  };

  const articleDir = path.join(__dirname, 'posts', slug);
  if (!fs.existsSync(articleDir)) fs.mkdirSync(articleDir, { recursive: true });

  const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${esc(title)} | Jean-François Lopresti</title>
<meta name="description" content="${esc(excerpt)}">
<meta name="robots" content="index, follow">
<link rel="canonical" href="${fullUrl}">
<meta property="og:type" content="article">
<meta property="og:site_name" content="Jean-François Lopresti — Présence digitale">
<meta property="og:url" content="${fullUrl}">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(excerpt)}">
<meta property="og:image" content="${image}">
<meta property="og:locale" content="fr_FR">
<meta property="article:published_time" content="${dateIso}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:image" content="${image}">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<meta name="theme-color" content="#E8541A">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<script type="application/ld+json">${JSON.stringify(articleLd)}</script>
<script type="application/ld+json">${JSON.stringify(breadcrumbLd)}</script>
<style>
:root{--bg:#FFFFFF;--bg2:#F7F6F4;--bg3:#F0EEE9;--accent:#E8541A;--accent-h:#1B3A5C;--accent-l:#FEF0EB;--text:#1A1A1A;--muted:#595959;--border:#E5E3DF;--shadow-h:0 6px 28px rgba(232,84,26,0.18);}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:linear-gradient(to bottom, rgba(232,84,26,0.12) 0%, #FFFFFF 50%, rgba(27,58,92,0.13) 100%);background-attachment:fixed;color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;}
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:1.1rem 4rem;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);}
.nav-logo{text-decoration:none;display:inline-flex;align-items:center;}
.nav-back{font-size:.85rem;font-weight:500;color:var(--muted);text-decoration:none;transition:color .2s;}
.nav-back:hover{color:#1B3A5C;}
main{position:relative;z-index:1;max-width:760px;margin:0 auto;padding:8rem 4rem 6rem;}
.art-meta{display:flex;gap:.8rem;align-items:center;margin-bottom:2rem;}
.art-cat{font-size:.72rem;font-weight:700;color:var(--accent);background:var(--accent-l);padding:.25rem .7rem;border-radius:20px;letter-spacing:.05em;}
.art-date{font-size:.75rem;color:var(--muted);}
.art-cover{width:100%;height:auto;display:block;margin-bottom:2.5rem;border:1.5px solid var(--border);border-radius:4px;}
h1{font-family:'Syne',sans-serif;font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;line-height:1.1;letter-spacing:-.02em;margin-bottom:1.5rem;color:var(--text);}
.art-excerpt{font-size:1.05rem;color:var(--muted);line-height:1.8;margin-bottom:2.5rem;padding:.8rem 1rem .8rem 1.2rem;border-left:3px solid var(--accent);background:rgba(255,255,255,0.85);}
.art-body{font-size:1rem;color:#3A3A3A;line-height:1.9;}
.art-body h2{font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;margin:2.5rem 0 .9rem;color:#1B3A5C;}
.art-body h3{font-family:'Syne',sans-serif;font-size:1.15rem;font-weight:700;margin:2rem 0 .7rem;color:#1B3A5C;}
.art-body p{margin-bottom:1.2rem;}
.art-body ul{list-style:none;padding:0;margin-bottom:1.2rem;}
.art-body ul li{padding:.4rem 0;border-bottom:1px solid var(--border);display:flex;gap:.6rem;align-items:flex-start;}
.art-body ul li::before{content:'›';color:var(--accent);font-size:1rem;flex-shrink:0;margin-top:.05rem;}
.art-body strong{color:var(--text);font-weight:600;}
.art-body a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(232,84,26,.3);transition:border-color .2s;}
.art-body a:hover{border-color:var(--accent);}
.art-body img{max-width:100%;height:auto;margin:1.5rem 0;border:1.5px solid var(--border);border-radius:4px;}
.art-footer{margin-top:3rem;padding-top:2rem;border-top:1.5px solid var(--border);display:flex;gap:1rem;flex-wrap:wrap;}
.btn-outline{display:inline-flex;align-items:center;gap:.6rem;padding:.8rem 1.5rem;background:transparent;color:var(--text);font-size:.85rem;font-weight:600;text-decoration:none;border:1.5px solid var(--border);border-radius:3px;transition:all .2s;}
.btn-outline:hover{border-color:#1B3A5C;color:#fff;background:#1B3A5C;}
.btn-primary{display:inline-flex;align-items:center;gap:.6rem;padding:.8rem 1.5rem;background:var(--accent);color:#fff;font-size:.85rem;font-weight:600;text-decoration:none;border-radius:3px;transition:background .2s;}
.btn-primary:hover{background:var(--accent-h);}
${SITE_FOOTER_CSS}
@media(max-width:900px){nav{padding:1rem 1.5rem;}main{padding:6rem 1.5rem 4rem;}}
</style>
</head>
<body>
<canvas id="particles-canvas" style="position:fixed;top:0;left:0;width:100%;height:100%;pointer-events:none;z-index:0;opacity:0.45;"></canvas>
<nav>
  <a href="/" class="nav-logo">${LOGO_SVG}</a>
  <a href="/blog/" class="nav-back">← Tous les articles</a>
</nav>
<main>
  <div class="art-meta">
    <span class="art-cat">${esc(meta.category || 'Conseils')}</span>
    <time class="art-date" datetime="${dateIso}">${esc(meta.date || '')}</time>
  </div>
  ${cover ? `<img src="${cover}" alt="${esc(title)}" class="art-cover">` : ''}
  <h1>${esc(title)}</h1>
  ${excerpt ? `<p class="art-excerpt">${esc(excerpt)}</p>` : ''}
  <div class="art-body">${mdToHtml(body)}</div>
  <aside class="local-cta">
    <h2>Vous êtes dans les Alpes-de-Haute-Provence ?</h2>
    <p>Je suis Jean-François Lopresti, consultant en présence digitale basé à Manosque. J'aide les artisans, commerçants et indépendants du 04 et de PACA à trouver des clients grâce à internet : <a href="/creation-site/">création de site web</a>, <a href="/attirer-visiteurs/">référencement Google local</a> et <a href="/formation-reseaux-sociaux/">réseaux sociaux</a>.</p>
    <p>Le premier diagnostic est gratuit : <a href="${contactUrl}">écrivez-moi</a> ou appelez le <a href="tel:${PHONE_TEL}">${PHONE}</a>.</p>
  </aside>
  <div class="art-footer">
    <a href="/blog/" class="btn-outline">← Tous les articles</a>
    <a href="${contactUrl}" class="btn-primary">Faire un diagnostic gratuit →</a>
  </div>
</main>
${SITE_FOOTER}
<script>
(function(){
  if(window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const canvas=document.getElementById("particles-canvas");
  const ctx=canvas.getContext("2d");
  let W,H,pts=[],lastScroll=0;
  const COLORS=["rgba(232,84,26,","rgba(27,58,92,"];
  function resize(){W=canvas.width=window.innerWidth;H=canvas.height=window.innerHeight;}
  resize();window.addEventListener("resize",resize,{passive:true});
  function mkPt(){return{x:Math.random()*W,y:Math.random()*H,vx:(Math.random()-.5)*.5,vy:(Math.random()-.5)*.5,r:Math.random()*2+.5,c:COLORS[Math.floor(Math.random()*COLORS.length)],a:Math.random()*.5+.15};}
  for(let i=0;i<70;i++)pts.push(mkPt());
  window.addEventListener("scroll",()=>{
    const sy=window.scrollY, delta=sy-lastScroll;
    pts.forEach(p=>{p.y-=delta*0.3;if(p.y<-10)p.y=H+10;if(p.y>H+10)p.y=-10;});
    lastScroll=sy;
  },{passive:true});
  function draw(){
    ctx.clearRect(0,0,W,H);
    pts.forEach(p=>{
      p.x+=p.vx;p.y+=p.vy;
      if(p.x<0)p.x=W;if(p.x>W)p.x=0;if(p.y<0)p.y=H;if(p.y>H)p.y=0;
      ctx.beginPath();ctx.arc(p.x,p.y,p.r,0,Math.PI*2);
      ctx.fillStyle=p.c+p.a+")";ctx.fill();
    });
    for(let i=0;i<pts.length;i++){for(let j=i+1;j<pts.length;j++){
      const dx=pts[i].x-pts[j].x,dy=pts[i].y-pts[j].y,d=Math.sqrt(dx*dx+dy*dy);
      if(d<130){ctx.beginPath();ctx.moveTo(pts[i].x,pts[i].y);ctx.lineTo(pts[j].x,pts[j].y);
      ctx.strokeStyle=pts[i].c+(0.12*(1-d/130))+")";ctx.lineWidth=.5;ctx.stroke();}
    }}
    requestAnimationFrame(draw);
  }
  draw();
})();
</script>
<script src="/lang.js" defer></script>
</body>
</html>`;

  fs.writeFileSync(path.join(articleDir, 'index.html'), htmlContent);

  return {
    title,
    date: meta.date || '',
    dateIso,
    category: meta.category || 'SEO',
    emoji,
    cover,
    excerpt,
    published,
    url,
    filename
  };
}).filter(Boolean);

fs.writeFileSync(outputFile, JSON.stringify(articles, null, 2));

// ---- Cartes d'articles en HTML statique (lisibles par Google) ----
function cardImg(p) {
  return p.cover
    ? `<div class="blog-img"><img src="${p.cover}" alt="${esc(p.title)}" loading="lazy"></div>`
    : `<div class="blog-img"><div class="blog-img-placeholder">${p.emoji || '📝'}</div></div>`;
}
const homeCards = articles.slice(0, 3).map(p =>
  `<a href="${p.url}" class="blog-card">${cardImg(p)}<div class="blog-meta"><span class="blog-cat">${esc(p.category)}</span><span class="blog-date">${esc(p.date)}</span></div><div class="blog-title">${esc(p.title)}</div><div class="blog-excerpt">${esc(p.excerpt)}</div></a>`
).join('');
const blogCards = articles.length ? articles.map(p =>
  `<a href="${p.url}" class="blog-card">${cardImg(p)}<div class="blog-meta"><span class="blog-cat">${esc(p.category)}</span><span class="blog-date">${esc(p.date)}</span></div><h2 class="blog-title">${esc(p.title)}</h2><p class="blog-excerpt">${esc(p.excerpt)}</p><span class="blog-link">Lire l'article →</span></a>`
).join('') : '<div class="empty">Les premiers articles arrivent bientôt.</div>';

function inject(file, htmlCards) {
  const f = path.join(__dirname, file);
  if (!fs.existsSync(f)) return;
  const src = fs.readFileSync(f, 'utf8');
  const out = src.replace(/<!-- POSTS:START -->[\s\S]*?<!-- POSTS:END -->/, () => `<!-- POSTS:START -->${htmlCards}<!-- POSTS:END -->`);
  if (out !== src) fs.writeFileSync(f, out);
}
inject('index.html', homeCards);
inject('blog/index.html', blogCards);

// ---- sitemap.xml ----
const urls = STATIC_PAGES.map(([u, prio, freq]) =>
  `  <url><loc>${SITE}${u}</loc><lastmod>${TODAY}</lastmod><changefreq>${freq}</changefreq><priority>${prio}</priority></url>`
).concat(articles.map(p =>
  `  <url><loc>${SITE}${encodeURI(p.url)}</loc><lastmod>${p.dateIso}</lastmod><changefreq>monthly</changefreq><priority>0.7</priority></url>`
));
fs.writeFileSync(path.join(__dirname, 'sitemap.xml'),
  `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>\n`);

console.log(`✅ ${articles.length} article(s) généré(s), sitemap : ${urls.length} URL`);
