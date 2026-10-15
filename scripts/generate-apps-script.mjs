import { createHash } from 'node:crypto';
import { readFile, mkdir, writeFile } from 'node:fs/promises';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { Script } from 'node:vm';
import ts from 'typescript';

export const SOURCE_FILES = Object.freeze(['Bcrypt.gs', 'Auth.gs', 'Code.gs']);
export const BACKEND_DIRECTORY = fileURLToPath(new URL('../backend/', import.meta.url));
export const OUTPUT_FILE = fileURLToPath(new URL('../backend/generated/FitZone_Complete.gs', import.meta.url));

const header = `/**
 * FitZone - complete Google Apps Script installation (V8).
 * GENERATED FILE: run npm run generate:backend; do not edit this copy.
 * Sources: backend/Bcrypt.gs -> backend/Auth.gs -> backend/Code.gs.
 * Paste this ENTIRE file into ONE .gs file in a new Apps Script project.
 * Do NOT also paste the three source files: that would duplicate global names.
 * Configure each gym privately in Script Properties; see INSTALLATION.md.
 * No gym credentials, spreadsheet IDs or deployment URLs are supplied here.
 * The bcryptjs copyright and license are retained below.
 */

`;

function bindingNames(name) {
  return ts.isIdentifier(name) ? [name.text] : name.elements.flatMap(element =>
    ts.isOmittedExpression(element) ? [] : bindingNames(element.name));
}

export function checkBundleGlobals(source) {
  // Parse, but never execute, the backend while generating its installation file.
  new Script(source, { filename: 'FitZone_Complete.gs' });
  const syntax = ts.createSourceFile('FitZone_Complete.js', source, ts.ScriptTarget.ES2022, true, ts.ScriptKind.JS);
  const names = new Set();
  for (const statement of syntax.statements) {
    const declared = ts.isFunctionDeclaration(statement) || ts.isClassDeclaration(statement)
      ? (statement.name ? [statement.name.text] : [])
      : ts.isVariableStatement(statement)
        ? statement.declarationList.declarations.flatMap(declaration => bindingNames(declaration.name)) : [];
    for (const name of declared) {
      if (names.has(name)) throw new Error(`Duplicate Apps Script global: ${name}`);
      names.add(name);
    }
  }
  return names;
}

export async function buildAppsScriptBundle(backendDirectory = BACKEND_DIRECTORY) {
  const sections = [];
  // An explicit allowlist prevents local .env files, old drafts or generated files
  // from becoming installation inputs. No environment configuration is read.
  for (const filename of SOURCE_FILES) {
    const source = (await readFile(resolve(backendDirectory, filename), 'utf8')).replace(/\r\n?/g, '\n');
    const hash = createHash('sha256').update(source).digest('hex');
    sections.push(`// ===== BEGIN backend/${filename} | SHA-256 ${hash} =====\n${source}\n;\n// ===== END backend/${filename} =====\n`);
  }
  const bundle = header + sections.join('\n');
  checkBundleGlobals(bundle);
  return bundle;
}

export async function generateAppsScriptBundle({ backendDirectory = BACKEND_DIRECTORY, outputFile = OUTPUT_FILE, check = false } = {}) {
  const expected = await buildAppsScriptBundle(backendDirectory);
  const current = await readFile(outputFile, 'utf8').catch(error => {
    if (error.code === 'ENOENT') return null;
    throw error;
  });
  if (check) {
    if (current !== expected) throw new Error('Generated Apps Script is missing or stale. Run npm run generate:backend.');
    return { changed: false };
  }
  if (current === expected) return { changed: false };
  await mkdir(dirname(outputFile), { recursive: true });
  await writeFile(outputFile, expected, 'utf8');
  return { changed: true };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  try {
    const args = process.argv.slice(2);
    if (args.some(arg => arg !== '--check')) throw new Error('Usage: node scripts/generate-apps-script.mjs [--check]');
    const check = args.includes('--check');
    const result = await generateAppsScriptBundle({ check });
    console.log(`backend/generated/FitZone_Complete.gs: ${check ? 'up to date' : result.changed ? 'generated' : 'already up to date'}`);
  } catch (error) {
    console.error(error.message);
    process.exitCode = 1;
  }
}
