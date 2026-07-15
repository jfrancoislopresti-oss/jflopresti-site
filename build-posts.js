// build-posts.js
// Ce script tourne automatiquement à chaque déploiement Netlify
// Il lit tous les fichiers .md dans /posts et génère posts/index.json

const fs = require('fs');
const path = require('path');

const postsDir = path.join(__dirname, 'posts');
const outputFile = path.join(postsDir, 'index.json');

// Fonction pour parser le front-matter YAML simple
function parseFrontMatter(content) {
  const match = content.match(/^---\n([\s\S]*?)\n---/);
  if (!match) return { meta: {}, body: content };
  
  const meta = {};
  const lines = match[1].split('\n');
  lines.forEach(line => {
    const [key, ...vals] = line.split(':');
    if (key && vals.length) {
      meta[key.trim()] = vals.join(':').trim().replace(/^["']|["']$/g, '');
    }
  });
  
  const body = content.replace(/^---\n[\s\S]*?\n---\n/, '');
  return { meta, body };
}

// Lire tous les fichiers .md dans /posts
const files = fs.readdirSync(postsDir)
  .filter(f => f.endsWith('.md'))
  .sort()
  .reverse(); // Plus récents en premier

const articles = files.map(filename => {
  const content = fs.readFileSync(path.join(postsDir, filename), 'utf8');
  const { meta } = parseFrontMatter(content);
  
  const slug = filename.replace(/^\d{4}-\d{2}-\d{2}-/, '').replace('.md', '');
  
  return {
    title: meta.title || 'Sans titre',
    date: meta.date || '',
    category: meta.category || 'SEO',
    emoji: meta.emoji || '📝',
    excerpt: meta.excerpt || '',
    published: meta.published !== 'false',
    url: `/posts/${slug}/`,
    filename
  };
}).filter(a => a.published);

fs.writeFileSync(outputFile, JSON.stringify(articles, null, 2));
console.log(`✅ ${articles.length} article(s) généré(s) dans posts/index.json`);
