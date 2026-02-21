# 博客文章翻译指南

这个工具可以自动将中文博客文章翻译成英文并发布。

## 设置

### 1. 安装依赖

```bash
npm install
```

### 2. 配置API密钥

在项目根目录创建 `.env` 文件，添加你的 Anthropic API 密钥：

```env
ANTHROPIC_API_KEY=your_anthropic_api_key_here
```

获取 API 密钥：
1. 访问 https://console.anthropic.com/
2. 创建或登录账号
3. 生成 API 密钥
4. 复制密钥到 `.env` 文件

## 使用方法

### 翻译新文章

1. 在 `src/content/blog/` 目录下创建你的中文文章，例如 `my-article.md`

2. 确保文章包含正确的 frontmatter 格式：

```markdown
---
title: "文章标题"
description: "文章描述"
pubDate: 2026-02-20
heroImage: ""
---

文章内容...
```

3. 运行翻译命令：

```bash
npm run translate my-article.md
```

或者使用完整路径：

```bash
npm run translate src/content/blog/my-article.md
```

4. 脚本会自动：
   - 使用 Claude 翻译标题、描述和内容
   - 创建 `my-article-en.md` 文件
   - 添加 `lang: "en"` 和 `translationOf: "my-article"` 到 frontmatter
   - 保存到 `src/content/blog/` 目录

## 示例

```bash
# 翻译单篇文章
npm run translate first-year-in-us.md

# 查看帮助
npm run translate
```

## 文件命名规则

- 中文文章：`article-name.md`
- 英文翻译：`article-name-en.md`

## 翻译质量

脚本使用 Claude Sonnet 4 进行翻译，能够：
- 保持原文的语气和风格
- 保留 Markdown 格式
- 提供自然流畅的英文表达
- 准确翻译技术术语

## 注意事项

- 确保原文使用标准的 Markdown frontmatter 格式
- API 调用需要网络连接
- 翻译长文章可能需要几秒钟时间
- 检查 `.env` 文件不要提交到 Git（已在 `.gitignore` 中）

## 故障排除

### API 密钥错误
```
❌ Missing ANTHROPIC_API_KEY
```
解决：检查 `.env` 文件是否存在且包含正确的 API 密钥

### 文件未找到
```
❌ File not found
```
解决：确保文件路径正确，文件存在于 `src/content/blog/` 目录

### 格式错误
```
Invalid markdown file format
```
解决：确保文件开头有正确的 frontmatter（以 `---` 包围）
