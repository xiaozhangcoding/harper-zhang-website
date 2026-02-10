#!/usr/bin/env node

import { Client } from '@notionhq/client';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT_DIR, 'src', 'content', 'blog');
const IMAGES_DIR = path.join(ROOT_DIR, 'public', 'images');

// Load .env file
const envPath = path.join(ROOT_DIR, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf-8');
  for (const line of envContent.split(/\r?\n/)) {
    const match = line.match(/^([^#=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  }
}

const NOTION_TOKEN = process.env.NOTION_TOKEN;
if (!NOTION_TOKEN) {
  console.error('Missing NOTION_TOKEN. Create a .env file in project root:');
  console.error('  NOTION_TOKEN=your_notion_integration_token');
  console.error('');
  console.error('To get a token:');
  console.error('  1. Go to https://www.notion.so/my-integrations');
  console.error('  2. Create a new integration');
  console.error('  3. Copy the token');
  console.error('  4. Share your Notion page with the integration');
  process.exit(1);
}

const notion = new Client({ auth: NOTION_TOKEN });

// --- Helpers ---

function extractPageId(urlOrId) {
  // Handle URLs like:
  //   https://www.notion.so/Page-Title-abc123def456...
  //   https://www.notion.so/workspace/abc123def456...
  //   https://notion.so/abc123def456...?v=...
  //   or raw ID with/without dashes
  const cleaned = urlOrId.replace(/-/g, '');
  const match = cleaned.match(/([a-f0-9]{32})/i);
  if (!match) {
    throw new Error(`Cannot extract page ID from: ${urlOrId}`);
  }
  const hex = match[1];
  // Format as UUID
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
}

function richTextToPlain(richText) {
  if (!richText) return '';
  return richText.map(t => t.plain_text).join('');
}

function richTextToMarkdown(richText) {
  if (!richText || richText.length === 0) return '';
  return richText.map(t => {
    let text = t.plain_text;
    if (!text) return '';
    if (t.annotations.bold) text = `**${text}**`;
    if (t.annotations.italic) text = `*${text}*`;
    if (t.annotations.strikethrough) text = `~~${text}~~`;
    if (t.annotations.code) text = `\`${text}\``;
    if (t.href) text = `[${text}](${t.href})`;
    return text;
  }).join('');
}

function generateSlug(title) {
  return title
    .toLowerCase()
    .replace(/[^\w\u4e00-\u9fff\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .substring(0, 60);
}

async function downloadImage(url, slug, index) {
  const imgDir = path.join(IMAGES_DIR, slug);
  if (!fs.existsSync(imgDir)) {
    fs.mkdirSync(imgDir, { recursive: true });
  }

  const ext = url.match(/\.(png|jpg|jpeg|gif|webp|svg)/i)?.[1] || 'jpg';
  const filename = `image-${index}.${ext}`;
  const filepath = path.join(imgDir, filename);

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const buffer = Buffer.from(await response.arrayBuffer());
    fs.writeFileSync(filepath, buffer);
    console.log(`  Downloaded: ${filename}`);
    return `/images/${slug}/${filename}`;
  } catch (err) {
    console.warn(`  Failed to download image: ${err.message}`);
    return url; // fallback to original URL
  }
}

// --- Notion block -> Markdown ---

async function blockToMarkdown(block, slug, imageCounter, indent = '') {
  const type = block.type;

  switch (type) {
    case 'paragraph':
      return indent + richTextToMarkdown(block.paragraph.rich_text);

    case 'heading_1':
      return `${indent}# ${richTextToMarkdown(block.heading_1.rich_text)}`;

    case 'heading_2':
      return `${indent}## ${richTextToMarkdown(block.heading_2.rich_text)}`;

    case 'heading_3':
      return `${indent}### ${richTextToMarkdown(block.heading_3.rich_text)}`;

    case 'bulleted_list_item':
      return `${indent}- ${richTextToMarkdown(block.bulleted_list_item.rich_text)}`;

    case 'numbered_list_item':
      return `${indent}1. ${richTextToMarkdown(block.numbered_list_item.rich_text)}`;

    case 'to_do': {
      const checked = block.to_do.checked ? 'x' : ' ';
      return `${indent}- [${checked}] ${richTextToMarkdown(block.to_do.rich_text)}`;
    }

    case 'quote':
      return `${indent}> ${richTextToMarkdown(block.quote.rich_text)}`;

    case 'callout':
      return `${indent}> ${richTextToMarkdown(block.callout.rich_text)}`;

    case 'code': {
      const lang = block.code.language === 'plain text' ? '' : (block.code.language || '');
      const code = richTextToPlain(block.code.rich_text);
      return `${indent}\`\`\`${lang}\n${code}\n${indent}\`\`\``;
    }

    case 'divider':
      return `${indent}---`;

    case 'image': {
      const imgUrl = block.image.type === 'file'
        ? block.image.file.url
        : block.image.external.url;
      const caption = block.image.caption?.length
        ? richTextToPlain(block.image.caption)
        : '';
      imageCounter.count++;
      const localPath = await downloadImage(imgUrl, slug, imageCounter.count);
      return caption
        ? `${indent}![${caption}](${localPath})`
        : `${indent}![](${localPath})`;
    }

    case 'video': {
      const videoUrl = block.video.type === 'file'
        ? block.video.file.url
        : block.video.external.url;
      return `${indent}<video src="${videoUrl}" controls></video>`;
    }

    case 'bookmark':
      return `${indent}[${block.bookmark.caption?.length ? richTextToPlain(block.bookmark.caption) : block.bookmark.url}](${block.bookmark.url})`;

    case 'embed':
      return `${indent}<iframe src="${block.embed.url}" width="100%" frameborder="0"></iframe>`;

    case 'toggle':
      return `${indent}**${richTextToMarkdown(block.toggle.rich_text)}**`;

    case 'table_of_contents':
    case 'breadcrumb':
    case 'column_list':
    case 'column':
      return ''; // skip layout blocks

    default:
      console.warn(`  Skipped unsupported block type: ${type}`);
      return '';
  }
}

// --- Fetch blocks with pagination ---

async function fetchBlocks(blockId) {
  const blocks = [];
  let cursor;
  do {
    const response = await notion.blocks.children.list({
      block_id: blockId,
      start_cursor: cursor,
      page_size: 100,
    });
    blocks.push(...response.results);
    cursor = response.has_more ? response.next_cursor : undefined;
  } while (cursor);
  return blocks;
}

// --- Convert all blocks recursively ---

async function blocksToMarkdown(blocks, slug, imageCounter, indent = '') {
  const lines = [];
  for (const block of blocks) {
    const md = await blockToMarkdown(block, slug, imageCounter, indent);
    if (md !== null && md !== undefined) {
      lines.push(md);
    }

    // Process children (toggles, lists with sub-items, etc.)
    if (block.has_children && !['child_page', 'child_database'].includes(block.type)) {
      const children = await fetchBlocks(block.id);
      const childLines = await blocksToMarkdown(children, slug, imageCounter, indent + '  ');
      lines.push(...childLines);
    }
  }
  return lines;
}

// --- Extract title from page ---

function extractTitle(page) {
  for (const [, prop] of Object.entries(page.properties)) {
    if (prop.type === 'title' && prop.title?.length > 0) {
      return richTextToPlain(prop.title);
    }
  }
  return 'untitled';
}

// --- Main ---

async function main() {
  const url = process.argv[2];
  const customSlug = process.argv[3];

  if (!url) {
    console.log('Usage: npm run notion <notion-page-url> [custom-slug]');
    console.log('');
    console.log('Examples:');
    console.log('  npm run notion https://www.notion.so/My-Page-abc123...');
    console.log('  npm run notion https://www.notion.so/My-Page-abc123... my-custom-slug');
    process.exit(1);
  }

  const pageId = extractPageId(url);
  console.log(`Fetching page ${pageId}...`);

  // Fetch page metadata
  const page = await notion.pages.retrieve({ page_id: pageId });
  const title = extractTitle(page);
  const slug = customSlug || generateSlug(title);
  const pubDate = page.created_time.split('T')[0];

  console.log(`  Title: ${title}`);
  console.log(`  Slug:  ${slug}`);
  console.log(`  Date:  ${pubDate}`);

  // Fetch and convert content
  console.log('Fetching content...');
  const blocks = await fetchBlocks(pageId);
  const imageCounter = { count: 0 };
  const mdLines = await blocksToMarkdown(blocks, slug, imageCounter);

  // Use first non-empty paragraph as description (truncated)
  const firstParagraph = mdLines.find(line => line.trim().length > 0 && !line.startsWith('#') && !line.startsWith('!')) || '';
  const description = firstParagraph.replace(/[*`~\[\]]/g, '').substring(0, 100);

  // Build markdown file
  const frontmatter = [
    '---',
    `title: "${title.replace(/"/g, '\\"')}"`,
    `description: "${description.replace(/"/g, '\\"')}"`,
    `pubDate: ${pubDate}`,
    'heroImage: ""',
    '---',
  ].join('\n');

  const content = `${frontmatter}\n\n${mdLines.join('\n\n')}\n`;
  const filePath = path.join(BLOG_DIR, `${slug}.md`);

  // Check if file already exists
  if (fs.existsSync(filePath)) {
    console.log(`\nFile already exists: ${slug}.md`);
    console.log('Overwriting...');
  }

  fs.writeFileSync(filePath, content, 'utf-8');

  console.log(`\nDone! Created: src/content/blog/${slug}.md`);
  if (imageCounter.count > 0) {
    console.log(`Downloaded ${imageCounter.count} image(s) to public/images/${slug}/`);
  }
  console.log('');
  console.log('Next steps:');
  console.log(`  1. Review the post: src/content/blog/${slug}.md`);
  console.log('  2. Edit the description if needed');
  console.log('  3. git add & commit & push to deploy');
}

main().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
