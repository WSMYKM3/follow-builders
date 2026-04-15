#!/usr/bin/env node

import { mkdir, readFile, writeFile } from 'fs/promises';
import { join } from 'path';

const SCRIPT_DIR = decodeURIComponent(new URL('.', import.meta.url).pathname);
const ROOT_DIR = join(SCRIPT_DIR, '..');
const TOCHECK_DIR = join(ROOT_DIR, 'ToCheck');

const STYLE_CSS = `:root {
  color-scheme: light;
  --bg: #f5efe3;
  --paper: #fffdf8;
  --panel: #f7f1e7;
  --panel-strong: #efe4d3;
  --text: #1f1a17;
  --muted: #6f655d;
  --accent: #125b50;
  --accent-soft: #d8ebe5;
  --border: #d8ccb8;
  --shadow: 0 18px 40px rgba(52, 35, 18, 0.08);
}

* {
  box-sizing: border-box;
}

html {
  font-size: 16px;
}

body {
  margin: 0;
  font-family: Georgia, "Times New Roman", serif;
  color: var(--text);
  background:
    radial-gradient(circle at top left, rgba(18, 91, 80, 0.08), transparent 30%),
    linear-gradient(180deg, #f8f2e8 0%, var(--bg) 100%);
}

a {
  color: var(--accent);
}

.page {
  width: min(1200px, calc(100% - 32px));
  margin: 0 auto;
  padding: 32px 0 56px;
}

.hero {
  background: linear-gradient(135deg, rgba(18, 91, 80, 0.92), rgba(49, 99, 155, 0.9));
  color: #f8f7f2;
  border-radius: 28px;
  padding: 32px;
  box-shadow: var(--shadow);
}

.hero h1,
.hero p {
  margin: 0;
}

.hero p + p {
  margin-top: 12px;
}

.summary-grid,
.meta-grid,
.state-grid {
  display: grid;
  gap: 16px;
  grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
  margin-top: 24px;
}

.summary-card,
.meta-card,
.state-card,
.section,
.item-card {
  background: var(--paper);
  border: 1px solid var(--border);
  border-radius: 22px;
  box-shadow: var(--shadow);
}

.summary-card,
.meta-card,
.state-card {
  padding: 18px 20px;
}

.summary-card strong,
.meta-card strong,
.state-card strong {
  display: block;
  font-size: 1.6rem;
  margin-bottom: 8px;
}

.summary-card span,
.meta-card span,
.state-card span,
.eyebrow,
.meta-line,
.empty-state {
  color: var(--muted);
}

.section {
  margin-top: 28px;
  padding: 24px;
}

.section-header {
  display: flex;
  flex-wrap: wrap;
  align-items: baseline;
  justify-content: space-between;
  gap: 12px;
  margin-bottom: 18px;
}

.section h2,
.item-card h3,
.item-card h4 {
  margin: 0;
}

.items {
  display: grid;
  gap: 16px;
}

.item-card {
  padding: 20px;
  background: linear-gradient(180deg, var(--paper) 0%, var(--panel) 100%);
}

.item-card + .item-card {
  margin-top: 0;
}

.tweet-list,
.tag-list {
  display: flex;
  flex-wrap: wrap;
  gap: 10px;
  padding: 0;
  margin: 12px 0 0;
  list-style: none;
}

.tag {
  display: inline-flex;
  align-items: center;
  padding: 6px 10px;
  border-radius: 999px;
  background: var(--accent-soft);
  color: var(--accent);
  font-size: 0.92rem;
}

.tweet {
  border-top: 1px solid var(--border);
  padding-top: 16px;
  margin-top: 16px;
}

.tweet:first-child {
  border-top: 0;
  padding-top: 0;
  margin-top: 14px;
}

.tweet p,
.content-block p {
  margin: 12px 0 0;
  white-space: pre-wrap;
  line-height: 1.6;
}

.content-block {
  margin-top: 14px;
}

details {
  margin-top: 14px;
}

summary {
  cursor: pointer;
  color: var(--accent);
  font-weight: 600;
}

.empty-state {
  padding: 18px 0 4px;
}

@media (max-width: 720px) {
  .page {
    width: min(100% - 20px, 1200px);
    padding-top: 20px;
  }

  .hero,
  .section,
  .item-card {
    padding: 20px;
    border-radius: 20px;
  }
}`;

function decodeEntities(value) {
  let result = String(value ?? '');
  for (let i = 0; i < 3; i += 1) {
    const next = result
      .replace(/&amp;/g, '&')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&nbsp;/g, ' ');
    if (next === result) break;
    result = next;
  }
  return result;
}

function escapeHtml(value) {
  return decodeEntities(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function formatDate(value) {
  if (!value) return 'Unknown';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return escapeHtml(value);
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
    timeZone: 'UTC'
  }).format(date);
}

function formatCount(value) {
  return new Intl.NumberFormat('en-US').format(value);
}

function formatTimestampMs(value) {
  if (!value) return 'Unknown';
  return formatDate(Number(value));
}

function summarizeText(text, maxLength = 420) {
  const clean = String(text ?? '').trim();
  if (clean.length <= maxLength) return clean;
  return `${clean.slice(0, maxLength).trimEnd()}...`;
}

async function readJson(filename) {
  const raw = await readFile(join(ROOT_DIR, filename), 'utf-8');
  return JSON.parse(raw);
}

function renderSummaryCard(label, value, description) {
  return `<div class="summary-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span><p class="eyebrow">${escapeHtml(description)}</p></div>`;
}

function renderMetaCard(label, value) {
  return `<div class="meta-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span></div>`;
}

function renderStateCard(label, value, description) {
  return `<div class="state-card"><strong>${escapeHtml(value)}</strong><span>${escapeHtml(label)}</span><p class="eyebrow">${escapeHtml(description)}</p></div>`;
}

function renderXSection(feedX) {
  if (!feedX.x?.length) {
    return `
      <section class="section">
        <div class="section-header">
          <h2>X / Twitter</h2>
          <span class="meta-line">Generated ${escapeHtml(formatDate(feedX.generatedAt))}</span>
        </div>
        <p class="empty-state">No tweets were included in this feed snapshot.</p>
      </section>
    `;
  }

  const builders = feedX.x.map(builder => {
    const tweets = (builder.tweets || []).map(tweet => {
      const tags = [
        `${formatCount(tweet.likes || 0)} likes`,
        `${formatCount(tweet.retweets || 0)} reposts`,
        `${formatCount(tweet.replies || 0)} replies`,
        tweet.isQuote ? 'Quote tweet' : 'Original tweet'
      ];

      return `
        <article class="tweet">
          <h4><a href="${escapeHtml(tweet.url)}" target="_blank" rel="noreferrer">View tweet</a></h4>
          <div class="meta-line">${escapeHtml(formatDate(tweet.createdAt))}</div>
          <ul class="tag-list">${tags.map(tag => `<li class="tag">${escapeHtml(tag)}</li>`).join('')}</ul>
          <p>${escapeHtml(tweet.text)}</p>
        </article>
      `;
    }).join('');

    return `
      <article class="item-card">
        <h3>${escapeHtml(builder.name)} <span class="eyebrow">@${escapeHtml(builder.handle)}</span></h3>
        <div class="content-block">
          <p>${escapeHtml(builder.bio || 'No bio available.')}</p>
        </div>
        ${tweets}
      </article>
    `;
  }).join('');

  return `
    <section class="section">
      <div class="section-header">
        <h2>X / Twitter</h2>
        <span class="meta-line">${escapeHtml(formatCount(feedX.x.length))} builders, ${escapeHtml(formatCount(feedX.stats?.totalTweets || 0))} tweets</span>
      </div>
      <div class="items">${builders}</div>
    </section>
  `;
}

function renderPodcastSection(feedPodcasts) {
  if (!feedPodcasts.podcasts?.length) {
    return `
      <section class="section">
        <div class="section-header">
          <h2>Podcasts</h2>
          <span class="meta-line">Generated ${escapeHtml(formatDate(feedPodcasts.generatedAt))}</span>
        </div>
        <p class="empty-state">No podcast episodes were included in this feed snapshot.</p>
      </section>
    `;
  }

  const items = feedPodcasts.podcasts.map(episode => `
    <article class="item-card">
      <h3>${escapeHtml(episode.title)}</h3>
      <p class="eyebrow">${escapeHtml(episode.name)} • ${escapeHtml(formatDate(episode.publishedAt))}</p>
      <p><a href="${escapeHtml(episode.url)}" target="_blank" rel="noreferrer">Open source link</a></p>
      <div class="content-block">
        <p>${escapeHtml(summarizeText(episode.transcript, 700))}</p>
      </div>
      <details>
        <summary>Show full transcript</summary>
        <div class="content-block">
          <p>${escapeHtml(episode.transcript || 'No transcript available.')}</p>
        </div>
      </details>
    </article>
  `).join('');

  return `
    <section class="section">
      <div class="section-header">
        <h2>Podcasts</h2>
        <span class="meta-line">${escapeHtml(formatCount(feedPodcasts.podcasts.length))} episodes</span>
      </div>
      <div class="items">${items}</div>
    </section>
  `;
}

function renderBlogSection(feedBlogs) {
  if (!feedBlogs.blogs?.length) {
    return `
      <section class="section">
        <div class="section-header">
          <h2>Blogs</h2>
          <span class="meta-line">Generated ${escapeHtml(formatDate(feedBlogs.generatedAt))}</span>
        </div>
        <p class="empty-state">No blog posts were included in this feed snapshot.</p>
      </section>
    `;
  }

  const items = feedBlogs.blogs.map(post => `
    <article class="item-card">
      <h3>${escapeHtml(post.title)}</h3>
      <p class="eyebrow">${escapeHtml(post.name)} • ${escapeHtml(formatDate(post.publishedAt))}</p>
      <p><a href="${escapeHtml(post.url)}" target="_blank" rel="noreferrer">Open article</a></p>
      ${post.description ? `<div class="content-block"><p>${escapeHtml(post.description)}</p></div>` : ''}
      <details>
        <summary>Show article content</summary>
        <div class="content-block">
          <p>${escapeHtml(post.content || 'No content available.')}</p>
        </div>
      </details>
    </article>
  `).join('');

  return `
    <section class="section">
      <div class="section-header">
        <h2>Blogs</h2>
        <span class="meta-line">${escapeHtml(formatCount(feedBlogs.blogs.length))} posts</span>
      </div>
      <div class="items">${items}</div>
    </section>
  `;
}

function renderHtml({ reportDate, feedX, feedPodcasts, feedBlogs, state }) {
  const totalTweets = (feedX.x || []).reduce((sum, builder) => sum + (builder.tweets?.length || 0), 0);
  const summaryCards = [
    renderSummaryCard('X builders', formatCount(feedX.x?.length || 0), 'Accounts with fresh tweets in this snapshot'),
    renderSummaryCard('Tweets', formatCount(totalTweets), 'Total tweets collected from the X feed'),
    renderSummaryCard('Podcast episodes', formatCount(feedPodcasts.podcasts?.length || 0), 'Episodes with transcripts in this snapshot'),
    renderSummaryCard('Blog posts', formatCount(feedBlogs.blogs?.length || 0), 'Articles included from blog feeds')
  ].join('');

  const metaCards = [
    renderMetaCard('Report date (UTC)', reportDate),
    renderMetaCard('X generated', formatDate(feedX.generatedAt)),
    renderMetaCard('Podcasts generated', formatDate(feedPodcasts.generatedAt)),
    renderMetaCard('Blogs generated', formatDate(feedBlogs.generatedAt))
  ].join('');

  const seenTweets = Object.keys(state.seenTweets || {}).length;
  const seenVideos = Object.keys(state.seenVideos || {}).length;
  const seenArticles = Object.keys(state.seenArticles || {}).length;
  const latestStateTimestamp = Math.max(
    0,
    ...Object.values(state.seenTweets || {}),
    ...Object.values(state.seenVideos || {}),
    ...Object.values(state.seenArticles || {})
  );
  const stateCards = [
    renderStateCard('Seen tweet IDs', formatCount(seenTweets), 'Dedup entries currently stored in state-feed.json'),
    renderStateCard('Seen podcast IDs', formatCount(seenVideos), 'Episode GUIDs tracked to avoid repeats'),
    renderStateCard('Seen article URLs', formatCount(seenArticles), 'Blog URLs already consumed by the feed'),
    renderStateCard('Latest state update', formatTimestampMs(latestStateTimestamp), 'Newest timestamp recorded across the state file')
  ].join('');

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>Follow Builders Report • ${escapeHtml(reportDate)}</title>
  <link rel="stylesheet" href="../style.css">
</head>
<body>
  <main class="page">
    <section class="hero">
      <p class="eyebrow">Follow Builders • Daily Feed Report</p>
      <h1>${escapeHtml(reportDate)}</h1>
      <p>This report is generated from <code>feed-x.json</code>, <code>feed-podcasts.json</code>, <code>feed-blogs.json</code>, and <code>state-feed.json</code>.</p>
      <p>Each daily run writes a fresh dated folder in <code>ToCheck</code> while reusing the shared stylesheet.</p>
    </section>

    <section class="summary-grid">${summaryCards}</section>
    <section class="meta-grid">${metaCards}</section>

    <section class="section">
      <div class="section-header">
        <h2>State Snapshot</h2>
        <span class="meta-line">Dedup tracking overview</span>
      </div>
      <div class="state-grid">${stateCards}</div>
    </section>

    ${renderXSection(feedX)}
    ${renderPodcastSection(feedPodcasts)}
    ${renderBlogSection(feedBlogs)}
  </main>
</body>
</html>`;
}

async function main() {
  const [feedX, feedPodcasts, feedBlogs, state] = await Promise.all([
    readJson('feed-x.json'),
    readJson('feed-podcasts.json'),
    readJson('feed-blogs.json'),
    readJson('state-feed.json')
  ]);

  const reportDate = new Date().toISOString().slice(0, 10);
  const reportDir = join(TOCHECK_DIR, reportDate);

  await mkdir(reportDir, { recursive: true });
  await writeFile(join(TOCHECK_DIR, 'style.css'), STYLE_CSS);
  await writeFile(
    join(reportDir, 'index.html'),
    renderHtml({ reportDate, feedX, feedPodcasts, feedBlogs, state })
  );

  console.error(`Report written to ToCheck/${reportDate}/index.html`);
}

main().catch(err => {
  console.error('Report generation failed:', err.message);
  process.exit(1);
});
