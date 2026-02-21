#!/usr/bin/env node

import Anthropic from '@anthropic-ai/sdk';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT_DIR = path.resolve(__dirname, '..');
const BLOG_DIR = path.join(ROOT_DIR, 'src', 'content', 'blog');

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

const ANTHROPIC_API_KEY = process.env.ANTHROPIC_API_KEY;
if (!ANTHROPIC_API_KEY) {
  console.error('❌ Missing ANTHROPIC_API_KEY. Create a .env file in project root:');
  console.error('  ANTHROPIC_API_KEY=your_anthropic_api_key');
  console.error('');
  console.error('To get an API key:');
  console.error('  1. Go to https://console.anthropic.com/');
  console.error('  2. Create an API key');
  console.error('  3. Add it to .env file');
  process.exit(1);
}

const anthropic = new Anthropic({
  apiKey: ANTHROPIC_API_KEY,
});

// Parse frontmatter and content
function parseMdFile(content) {
  // Normalize line endings to \n
  content = content.replace(/\r\n/g, '\n');
  
  const frontmatterRegex = /^---\n([\s\S]*?)\n---\n([\s\S]*)$/;
  const match = content.match(frontmatterRegex);
  
  if (!match) {
    throw new Error('Invalid markdown file format. Missing frontmatter.');
  }
  
  const frontmatter = match[1];
  const body = match[2];
  
  // Parse frontmatter into object
  const frontmatterObj = {};
  frontmatter.split('\n').forEach(line => {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      let value = line.substring(colonIndex + 1).trim();
      // Remove quotes if present
      if ((value.startsWith('"') && value.endsWith('"')) || 
          (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      frontmatterObj[key] = value;
    }
  });
  
  return { frontmatter: frontmatterObj, body };
}

// Translate content using Claude
async function translateWithClaude(content) {
  console.log('🤖 Translating with Claude...');
  
  const message = await anthropic.messages.create({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 8000,
    messages: [
      {
        role: 'user',
        content: `Please translate the following Chinese blog post to English. Maintain the same tone, style, and formatting (including markdown). Keep it natural and readable in English.

${content}`
      }
    ],
  });
  
  return message.content[0].text;
}

// Generate English filename from Chinese filename
function generateEnFilename(chineseFilename) {
  // Remove .md extension
  const baseName = chineseFilename.replace(/\.md$/, '');
  // If already ends with -en, return as is
  if (baseName.endsWith('-en')) {
    return chineseFilename;
  }
  // Add -en suffix
  return `${baseName}-en.md`;
}

// Main function
async function translateBlog(inputFile) {
  try {
    // Check if file exists
    const inputPath = path.isAbsolute(inputFile) 
      ? inputFile 
      : path.join(BLOG_DIR, inputFile);
    
    if (!fs.existsSync(inputPath)) {
      console.error(`❌ File not found: ${inputPath}`);
      process.exit(1);
    }
    
    console.log(`📖 Reading file: ${path.basename(inputPath)}`);
    const content = fs.readFileSync(inputPath, 'utf-8');
    
    // Parse the file
    const { frontmatter, body } = parseMdFile(content);
    
    console.log(`📝 Original title: ${frontmatter.title}`);
    
    // Translate title, description, and body
    const [translatedTitle, translatedDescription, translatedBody] = await Promise.all([
      translateWithClaude(frontmatter.title),
      frontmatter.description ? translateWithClaude(frontmatter.description) : Promise.resolve(''),
      translateWithClaude(body)
    ]);
    
    // Create English frontmatter
    const enFrontmatter = {
      title: translatedTitle.replace(/^["']|["']$/g, ''),
      description: translatedDescription.replace(/^["']|["']$/g, ''),
      pubDate: frontmatter.pubDate,
      heroImage: frontmatter.heroImage || '',
      lang: 'en',
      translationOf: path.basename(inputPath, '.md')
    };
    
    // Build English markdown file
    let enContent = '---\n';
    Object.entries(enFrontmatter).forEach(([key, value]) => {
      enContent += `${key}: "${value}"\n`;
    });
    enContent += '---\n';
    enContent += translatedBody;
    
    // Generate output filename
    const outputFilename = generateEnFilename(path.basename(inputPath));
    const outputPath = path.join(BLOG_DIR, outputFilename);
    
    // Write to file
    fs.writeFileSync(outputPath, enContent, 'utf-8');
    
    console.log('✅ Translation complete!');
    console.log(`📄 English version saved to: ${outputFilename}`);
    console.log(`🔗 Original: ${path.basename(inputPath)}`);
    console.log(`🔗 Translation: ${outputFilename}`);
    
  } catch (error) {
    console.error('❌ Error:', error.message);
    if (error.response) {
      console.error('API Error:', error.response.data);
    }
    process.exit(1);
  }
}

// CLI usage
const args = process.argv.slice(2);
if (args.length === 0) {
  console.log('Usage: npm run translate <input-file.md>');
  console.log('');
  console.log('Examples:');
  console.log('  npm run translate my-new-post.md');
  console.log('  npm run translate src/content/blog/my-new-post.md');
  process.exit(0);
}

const inputFile = args[0];
translateBlog(inputFile);
