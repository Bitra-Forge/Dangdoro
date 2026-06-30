import { execSync } from 'child_process';

const files = ['app/page.tsx', 'app/groups/page.tsx', 'app/leaderboard/page.tsx'];
const commit = '56706d5';

for (const file of files) {
  console.log(`=== ${file} ===`);
  try {
    const content = execSync(`git show ${commit}:${file}`).toString();
    const tourStepMatch = content.match(/const tourSteps[\s\S]*?=\s*\[([\s\S]*?)\];/);
    if (tourStepMatch) {
      console.log(tourStepMatch[0]);
    } else {
      // search for useTour
      const useTourIndex = content.indexOf("useTour(");
      if (useTourIndex !== -1) {
        console.log("Found useTour call, showing surrounding content:");
        console.log(content.slice(useTourIndex - 500, useTourIndex + 500));
      } else {
        console.log("Could not find tour steps or useTour");
      }
    }
  } catch (err: any) {
    console.error(`Error reading ${file}:`, err.message);
  }
  console.log("\n");
}
