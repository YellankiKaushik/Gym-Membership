import ts from 'typescript';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { checkBundleGlobals } from './generate-apps-script.mjs';

const files = execFileSync('git', ['ls-files', '-z'], { encoding: 'utf8' }).split('\0').filter(Boolean);
const problems = [];
let checked = 0;
for (const file of files.filter(file => /^(src|api|server)\/.*\.[cm]?[jt]sx?$/.test(file))) {
  const source = readFileSync(file, 'utf8');
  const syntax = ts.createSourceFile(file, source, ts.ScriptTarget.Latest, true, file.endsWith('tsx') ? ts.ScriptKind.TSX : ts.ScriptKind.TS);
  const report = (node, reason) => problems.push(`${file}:${syntax.getLineAndCharacterOfPosition(node.getStart(syntax)).line + 1} ${reason}`);
  const visit = node => {
    if (ts.isJsxAttribute(node) && node.name.getText(syntax) === 'dangerouslySetInnerHTML') report(node, 'unsafe HTML sink');
    if ((ts.isCallExpression(node) || ts.isNewExpression(node)) && ['eval', 'Function', 'document.write', 'document.writeln'].includes(node.expression.getText(syntax))) report(node, 'dynamic code/HTML sink');
    if (ts.isBinaryExpression(node) && node.operatorToken.kind === ts.SyntaxKind.EqualsToken && /\.(innerHTML|outerHTML)$/.test(node.left.getText(syntax))) report(node, 'HTML assignment');
    ts.forEachChild(node, visit);
  };
  visit(syntax); checked++;
}
for (const name of ['Auth', 'Code']) checkBundleGlobals(readFileSync(`backend/${name}.gs`, 'utf8'));
if (problems.length) { console.error(problems.join('\n')); process.exitCode = 1; }
else console.log(`Targeted security guard: ${checked} application modules; backend syntax/globals parsed. Not a full SAST scanner or proof of authorization.`);
