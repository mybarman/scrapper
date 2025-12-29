import { scrapeCase } from "./core.js";

// Parse arguments: node scrape.js <caseType> <caseNumber> <caseYear>
const [caseType, caseNumber, caseYear] = process.argv.slice(2);

if (!caseType || !caseNumber || !caseYear) {
    console.error("Usage: node scrape.js <caseType> <caseNumber> <caseYear>");
    console.error("Example: node scrape.js 139 1 2025");
    process.exit(1);
}

const result = await scrapeCase({ caseType, caseNumber, caseYear });

// Output the final result as JSON to stdout
console.log(JSON.stringify(result, null, 2));
process.exit(result.success ? 0 : 1);