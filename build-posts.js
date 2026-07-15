const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'posts');
const outputFile = path.join(postsDir, 'index.json');

function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: content };
  const meta = {};
  match[1].split('\n').forEach(line => {
    const [key, ...vals] = line.split(':');
    if (key && vals.length) meta[key.trim()] = vals.join(':').trim().replace(/^["']|["']$/g, '');
  });
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');
  return { meta, body };
}

function mdToHtml(md) {
  return md
    .replace(/^### (.+)$/gm, '<h3>$1</h3>')
    .replace(/^## (.+)$/gm, '<h2>$1</h2>')
    .replace(/^# (.+)$/gm, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>')
    .replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>')
    .replace(/^- (.+)$/gm, '<li>$1</li>')
    .replace(/(<li>.*<\/li>\n?)+/g, '<ul>$&</ul>')
    .split('\n').filter(l => l.trim())
    .map(l => l.match(/^<[hul]/) ? l : `<p>${l}</p>`).join('\n');
}

const files = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'))
  .sort().reverse();

const articles = files.map(filename => {
  const content = fs.readFileSync(path.join(postsDir, filename), 'utf8');
  const { meta, body } = parseFrontMatter(content);
  const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace('.md', '');
  const url = `/posts/${slug}/`;
  const cover = meta.cover || null;
  const emoji = meta.emoji || '📝';

  // Thumbnail HTML : image si dispo, sinon emoji
  const thumbHtml = cover
    ? `<img src="${cover}" alt="${meta.title || ''}" style="width:100%;height:100%;object-fit:cover;">`
    : `<span style="font-size:3rem;opacity:.4;">${emoji}</span>`;

  // Cover pour la page article
  const articleCoverHtml = cover
    ? `<img src="${cover}" alt="${meta.title || ''}" style="width:100%;max-height:420px;object-fit:cover;margin-bottom:2.5rem;">`
    : `<span class="art-emoji">${emoji}</span>`;

  // Génère la page HTML de l'article
  const articleDir = path.join(__dirname, 'posts', slug);
  if (!fs.existsSync(articleDir)) fs.mkdirSync(articleDir, { recursive: true });

  const htmlContent = `<!DOCTYPE html>
<html lang="fr">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>${meta.title || 'Article'} — Jean-François Lopresti</title>
<meta name="description" content="${meta.excerpt || ''}">
${cover ? `<meta property="og:image" content="https://jflopresti.fr${cover}">` : ''}
<link rel="canonical" href="https://jflopresti.fr${url}">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=DM+Mono:wght@400;500&family=Inter:wght@300;400;500&display=swap" rel="stylesheet">
<style>
:root{--bg:#060610;--bg2:#0a0a1a;--bg3:#0f0f25;--p1:#8b5cf6;--p3:#ec4899;--accent:#c084fc;--text:#f1f0ff;--muted:#7c7a9e;--border:rgba(139,92,246,0.18);}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;}
body::before{content:'';position:fixed;inset:0;background-image:linear-gradient(rgba(139,92,246,.025) 1px,transparent 1px),linear-gradient(90deg,rgba(139,92,246,.025) 1px,transparent 1px);background-size:70px 70px;pointer-events:none;z-index:0;}
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:1.1rem 4rem;background:rgba(6,6,16,.85);backdrop-filter:blur(20px);border-bottom:1px solid var(--border);}
.nav-logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.05rem;background:linear-gradient(90deg,var(--p1),var(--p3));-webkit-background-clip:text;-webkit-text-fill-color:transparent;background-clip:text;text-decoration:none;}
.nav-back{font-family:'DM Mono',monospace;font-size:.72rem;color:var(--muted);text-decoration:none;letter-spacing:.1em;display:flex;align-items:center;gap:.5rem;transition:color .2s;}
.nav-back:hover{color:var(--accent);}
main{position:relative;z-index:1;max-width:780px;margin:0 auto;padding:8rem 4rem 6rem;}
.art-meta{display:flex;gap:1rem;align-items:center;margin-bottom:2rem;}
.art-cat{font-family:'DM Mono',monospace;font-size:.62rem;letter-spacing:.15em;color:var(--accent);background:rgba(139,92,246,.1);border:1px solid rgba(139,92,246,.2);padding:.25rem .7rem;}
.art-date{font-family:'DM Mono',monospace;font-size:.62rem;color:var(--muted);}
.art-emoji{font-size:3rem;margin-bottom:1.5rem;display:block;}
h1{font-family:'Syne',sans-serif;font-size:clamp(1.8rem,4vw,3rem);font-weight:800;line-height:1.1;letter-spacing:-.02em;margin-bottom:1.5rem;}
.art-excerpt{font-size:1.1rem;color:var(--muted);line-height:1.8;margin-bottom:3rem;padding-bottom:2rem;border-bottom:1px solid var(--border);}
.art-body{font-size:.98rem;color:rgba(241,240,255,.8);line-height:1.9;}
.art-body h2{font-family:'Syne',sans-serif;font-size:1.5rem;font-weight:800;margin:2.5rem 0 1rem;color:var(--text);}
.art-body h3{font-family:'Syne',sans-serif;font-size:1.2rem;font-weight:700;margin:2rem 0 .8rem;color:var(--text);}
.art-body p{margin-bottom:1.2rem;}
.art-body ul{padding-left:1.5rem;margin-bottom:1.2rem;}
.art-body li{margin-bottom:.5rem;}
.art-body strong{color:var(--text);}
.art-body a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(192,132,252,.3);}
.art-body img{max-width:100%;margin:1.5rem 0;border:1px solid var(--border);}
.art-footer{margin-top:4rem;padding-top:2rem;border-top:1px solid var(--border);display:flex;gap:1rem;flex-wrap:wrap;}
.btn{display:inline-flex;align-items:center;gap:.6rem;padding:.8rem 1.5rem;font-family:'DM Mono',monospace;font-size:.72rem;letter-spacing:.08em;text-decoration:none;transition:all .3s;}
.btn-outline{background:transparent;color:var(--text);border:1px solid var(--border);}
.btn-outline:hover{border-color:var(--p1);color:var(--accent);}
@media(max-width:900px){nav{padding:1.1rem 1.5rem;}main{padding:6rem 1.5rem 4rem;}}
</style>
</head>
<body>
<nav>
  <a href="/" class="nav-logo">JFL</a>
  <a href="/blog/" class="nav-back">← Tous les articles</a>
</nav>
<main>
  <div class="art-meta">
    <span class="art-cat">${meta.category || 'SEO'}</span>
    <span class="art-date">${meta.date || ''}</span>
  </div>
  ${articleCoverHtml}
  <h1>${meta.title || 'Article'}</h1>
  ${meta.excerpt ? `<p class="art-excerpt">${meta.excerpt}</p>` : ''}
  <div class="art-body">${mdToHtml(body)}</div>
  <div class="art-footer">
    <a href="/blog/" class="btn btn-outline">← Tous les articles</a>
    <a href="/#contact" class="btn btn-outline">Me contacter</a>
  </div>
</main>
</body>
</html>`;

  fs.writeFileSync(path.join(articleDir, 'index.html'), htmlContent);

  return {
    title: meta.title || 'Sans titre',
    date: meta.date || '',
    category: meta.category || 'SEO',
    emoji,
    cover,
    thumbHtml,
    excerpt: meta.excerpt || '',
    published: meta.published !== 'false',
    url,
    filename
  };
}).filter(a => a.published);

fs.writeFileSync(outputFile, JSON.stringify(articles, null, 2));
console.log(`✅ ${articles.length} article(s) généré(s)`);
