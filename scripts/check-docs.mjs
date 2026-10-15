import { execFileSync } from 'node:child_process';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { dirname, resolve, extname } from 'node:path';

// Check only repository Markdown, never ignored environment files or local evidence.
const root = process.cwd();
const files = [...new Set(execFileSync('git', ['ls-files', '--cached', '--others', '--exclude-standard', '-z'],
  { encoding: 'utf8' }).split('\0').filter(file => extname(file) === '.md' && existsSync(file)))];
const problems = [];
const withoutFences = text => text.replace(/^\s*(`{3,}|~{3,})[^\n]*\n[\s\S]*?^\s*\1\s*$/gm, '');
const headings = text => {
  const counts = new Map();
  return new Set([...withoutFences(text).matchAll(/^#{1,6}\s+(.+?)\s*#*$/gm)].map(match => {
    const slug = match[1].toLowerCase().replace(/<[^>]*>/g, '').replace(/[^\p{L}\p{N}\s_-]/gu, '').replace(/\s/g, '-');
    const count = counts.get(slug) || 0;
    counts.set(slug, count + 1);
    return slug + (count ? '-' + count : '');
  }));
};
let checked = 0;
for (const file of files) {
  const source = withoutFences(readFileSync(file, 'utf8'));
  const links = source.matchAll(/!?\[[^\]]*\]\((<[^>]+>|[^)\s]+)(?:\s+"[^"]*")?\)/g);
  for (const match of links) {
    const href = match[1].replace(/^<|>$/g, '');
    if (/^[a-z][a-z\d+.-]*:|^\/\//i.test(href)) continue;
    const [path, fragment] = href.split('#', 2);
    const target = path ? resolve(dirname(resolve(root, file)), decodeURIComponent(path)) : resolve(root, file);
    checked++;
    if (!existsSync(target)) problems.push(`${file}: missing link target ${href}`);
    else if (fragment && extname(target) === '.md' && statSync(target).isFile() &&
      !headings(readFileSync(target, 'utf8')).has(decodeURIComponent(fragment))) {
      problems.push(`${file}: missing heading ${href}`);
    }
  }
}
if (problems.length) {
  console.error(problems.join('\n'));
  process.exitCode = 1;
} else console.log(`Documentation: ${files.length} Markdown files, ${checked} local links/anchors checked.`);
