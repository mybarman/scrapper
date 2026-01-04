import "dotenv/config";
import { chromium } from "playwright";
import fs from "fs/promises";
import { processCaseType } from "./worker.js";

// Regex to extract JSON objects from the TS file
// Matching { "id": "...", "label": "..." }
const CASE_TYPE_REGEX = /{\s*"id":\s*"([^"]+)",\s*"label":\s*"([^"]+)"\s*}/g;

async function getCaseTypes() {
    const content = await fs.readFile("./case-type.ts", "utf8");
    const matches = [...content.matchAll(CASE_TYPE_REGEX)];

    return matches.map(m => ({
        id: m[1],
        label: m[2]
    }));
}

async function runOrchestrator() {
    const args = process.argv.slice(2);
    if (args.length < 1) {
        console.error("Usage: node orchestrator.js <year> [startCaseNumber=1]");
        process.exit(1);
    }

    const year = args[0];
    const initialStartNumber = args[1] ? parseInt(args[1], 10) : 1;
    console.log(`Starting Orchestrator for Year: ${year} (Sequential Mode)`);

    const caseTypes = await getCaseTypes();
    console.log(`Found ${caseTypes.length} case types to process.`);

    // Launch ONE shared browser for the entire run
    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== "false",
        slowMo: 100
    });

    try {
        for (const ct of caseTypes) {
            console.log(`\n========================================`);
            console.log(`Starting Processing for: ${ct.label} (ID: ${ct.id})`);
            console.log(`========================================\n`);

            try {
                // Run the worker logic for this case type
                // Always start from 1 (or provided start number)
                await processCaseType(browser, ct.id, initialStartNumber, year);
            } catch (err) {
                console.error(`Error processing case type ${ct.label}:`, err);
                // Continue to next case type even if one fails
            }
        }
    } finally {
        await browser.close();
        console.log("Orchestrator finished all case types.");
    }
}

runOrchestrator();
