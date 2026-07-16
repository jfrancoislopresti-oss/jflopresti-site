const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'posts');
const outputFile = path.join(postsDir, 'index.json');

function parseFrontMatter(content) {
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

  // Map category to contact form situation
  const categoryToSituation = {
    'Être visible sur Google': 'visibilite',
    'Améliorer son site': 'conversion',
    'Trouver des clients': 'creation',
    'Développer son activité': 'creation'
  };
  const situation = categoryToSituation[meta.category] || 'diagnostic';
  const contactUrl = `/?situation=${situation}#contact`;
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
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="shortcut icon" href="/favicon.svg">
<meta name="theme-color" content="#C4622D">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link href="https://fonts.googleapis.com/css2?family=Syne:wght@700;800&family=Inter:wght@300;400;500;600&display=swap" rel="stylesheet">
<style>
:root{--bg:#FFFFFF;--bg2:#F7F6F4;--bg3:#F0EEE9;--accent:#C4622D;--accent-h:#A84E22;--accent-l:#F2E8E1;--text:#1A1A1A;--muted:#6B6B6B;--border:#E5E3DF;--shadow-h:0 6px 28px rgba(196,98,45,0.18);}
*{margin:0;padding:0;box-sizing:border-box;}
body{background:var(--bg);color:var(--text);font-family:'Inter',sans-serif;min-height:100vh;}
nav{position:fixed;top:0;left:0;right:0;z-index:100;display:flex;align-items:center;justify-content:space-between;padding:1.1rem 4rem;background:rgba(255,255,255,.95);backdrop-filter:blur(12px);border-bottom:1px solid var(--border);}
.nav-logo{font-family:'Syne',sans-serif;font-weight:800;font-size:1.1rem;color:var(--accent);text-decoration:none;}
.nav-back{font-size:.85rem;font-weight:500;color:var(--muted);text-decoration:none;transition:color .2s;}
.nav-back:hover{color:var(--accent);}
main{max-width:760px;margin:0 auto;padding:8rem 4rem 6rem;}
.art-meta{display:flex;gap:.8rem;align-items:center;margin-bottom:2rem;}
.art-cat{font-size:.68rem;font-weight:700;color:var(--accent);background:var(--accent-l);padding:.25rem .7rem;border-radius:20px;letter-spacing:.05em;}
.art-date{font-size:.72rem;color:var(--muted);}
.art-cover{width:100%;height:auto;display:block;margin-bottom:2.5rem;border:1.5px solid var(--border);border-radius:4px;}
h1{font-family:'Syne',sans-serif;font-size:clamp(1.8rem,4vw,2.8rem);font-weight:800;line-height:1.1;letter-spacing:-.02em;margin-bottom:1.5rem;color:var(--text);}
.art-excerpt{font-size:1.05rem;color:var(--muted);line-height:1.8;margin-bottom:2.5rem;padding:.8rem 1rem .8rem 1.2rem;border-left:3px solid var(--accent);background:var(--bg2);}
.art-body{font-size:.96rem;color:#3A3A3A;line-height:1.9;}
.art-body h2{font-family:'Syne',sans-serif;font-size:1.4rem;font-weight:800;margin:2.5rem 0 .9rem;color:var(--text);}
.art-body h3{font-family:'Syne',sans-serif;font-size:1.15rem;font-weight:700;margin:2rem 0 .7rem;color:var(--text);}
.art-body p{margin-bottom:1.2rem;}
.art-body ul{list-style:none;padding:0;margin-bottom:1.2rem;}
.art-body ul li{padding:.4rem 0;border-bottom:1px solid var(--border);display:flex;gap:.6rem;align-items:flex-start;}
.art-body ul li::before{content:'›';color:var(--accent);font-size:1rem;flex-shrink:0;margin-top:.05rem;}
.art-body strong{color:var(--text);font-weight:600;}
.art-body a{color:var(--accent);text-decoration:none;border-bottom:1px solid rgba(196,98,45,.3);transition:border-color .2s;}
.art-body a:hover{border-color:var(--accent);}
.art-body img{max-width:100%;height:auto;margin:1.5rem 0;border:1.5px solid var(--border);border-radius:4px;}
.art-footer{margin-top:4rem;padding-top:2rem;border-top:1.5px solid var(--border);display:flex;gap:1rem;flex-wrap:wrap;}
.btn-outline{display:inline-flex;align-items:center;gap:.6rem;padding:.8rem 1.5rem;background:transparent;color:var(--text);font-size:.82rem;font-weight:600;text-decoration:none;border:1.5px solid var(--border);border-radius:3px;transition:all .2s;}
.btn-outline:hover{border-color:var(--accent);color:var(--accent);background:var(--accent-l);}
.btn-primary{display:inline-flex;align-items:center;gap:.6rem;padding:.8rem 1.5rem;background:var(--accent);color:#fff;font-size:.82rem;font-weight:600;text-decoration:none;border-radius:3px;transition:background .2s;}
.btn-primary:hover{background:var(--accent-h);}
footer{padding:2rem 4rem;border-top:1.5px solid var(--border);display:flex;justify-content:space-between;align-items:center;flex-wrap:wrap;gap:1rem;}
.ft-copy{font-size:.72rem;color:var(--muted);}
.ft-logo{font-family:'Syne',sans-serif;font-size:.95rem;font-weight:800;color:var(--accent);}
@media(max-width:900px){nav{padding:1rem 1.5rem;}main{padding:6rem 1.5rem 4rem;}footer{padding:2rem 1.5rem;flex-direction:column;text-align:center;}}
</style>
</head>
<body>
<nav>
  <a href="/" class="nav-logo">JFL</a>
  <a href="/blog/" class="nav-back">← Tous les articles</a>
</nav>
<main>
  <div class="art-meta">
    <span class="art-cat">${meta.category || 'Conseils'}</span>
    <span class="art-date">${meta.date || ''}</span>
  </div>
  ${cover ? `<img src="${cover}" alt="${meta.title || ''}" class="art-cover">` : ''}
  <h1>${meta.title || 'Article'}</h1>
  ${meta.excerpt ? `<p class="art-excerpt">${meta.excerpt}</p>` : ''}
  <div class="art-body">${mdToHtml(body)}</div>
  <div class="art-footer">
    <a href="/blog/" class="btn-outline">← Tous les articles</a>
    <a href="${contactUrl}" class="btn-primary">Faire un diagnostic gratuit →</a>
  </div>
</main>
<footer>
  <div class="ft-copy">© 2025 Jean-François Lopresti</div>
  <div class="ft-logo">JFL</div>
</footer>
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
