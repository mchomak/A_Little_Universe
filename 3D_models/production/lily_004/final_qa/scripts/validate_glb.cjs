const fs = require('node:fs');
const path = require('node:path');
const validator = require('C:/Users/McHomak/AppData/Local/Temp/lily004-gltf-validator/node_modules/gltf-validator');

const root = path.resolve(__dirname, '..');
const files = [
  path.join(root, 'baseline', 'lily_004_animated_original.glb'),
  path.join(root, 'export', 'lily_004_final.glb'),
];

async function main() {
  const result = {};
  for (const file of files) {
    const report = await validator.validateBytes(new Uint8Array(fs.readFileSync(file)), {
      uri: path.basename(file), format: 'glb', maxIssues: 0, writeTimestamp: false,
    });
    result[path.relative(root, file).replaceAll('\\', '/')] = report;
    const issues = report.issues ?? {};
    console.log(path.basename(file), JSON.stringify({
      version: report.validatorVersion,
      errors: issues.numErrors,
      warnings: issues.numWarnings,
      infos: issues.numInfos,
      hints: issues.numHints,
    }));
    for (const issue of issues.messages ?? []) {
      console.log(issue.severity, issue.code, issue.message);
    }
    if ((issues.numErrors ?? 0) > 0) process.exitCode = 1;
  }
  fs.writeFileSync(path.join(root, 'reports', 'validator-report.json'), JSON.stringify(result, null, 2) + '\n');
}

main().catch((error) => { console.error(error); process.exitCode = 1; });
