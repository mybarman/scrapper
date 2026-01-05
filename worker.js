import "dotenv/config";
import { chromium } from "playwright";
import { scrapeCaseInternal } from "./core.js";

// -- Configuration --
const API_BASE_URL = "https://caseinference.vercel.app" || "http://localhost:3000"; // Adjust default as needed

/**
 * Checks if a case exists/should be skipped via the external API.
 */
async function checkCaseStatus(caseType, caseNumber, caseYear) {
    try {
        const url = `${API_BASE_URL}/api/cases/check`;
        const body = { caseType, caseNumber, caseYear };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.warn(`[API Check] Failed: ${response.status} ${response.statusText}`);
            return { shouldSkip: false }; // Fail open: scrape it if we can't check
        }

        const data = await response.json();
        // data structure assumed: { exists: boolean, status: string, nextCaseNumber?: number }
        return {
            shouldSkip: data.exists && data.status === "FOUND",
            nextCaseNumber: data.nextCaseNumber
        };

    } catch (error) {
        console.error(`[API Check] Error:`, error.message);
        return { shouldSkip: false };
    }
}

/**
 * Saves the scraping result to the external API.
 */
async function saveCaseResult(caseType, caseNumber, caseYear, result) {
    try {
        const url = `${API_BASE_URL}/api/cases/save`;
        const body = {
            caseType,
            caseNumber,
            caseYear,
            result,
            // Include helpful flags
            isNotFound: result.error === "Record doesn't exist"
        };

        const response = await fetch(url, {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify(body)
        });

        if (!response.ok) {
            console.error(`[API Save] Failed: ${response.status} ${response.statusText}`);
        } else {
            console.log(`[API Save] Saved result for ${caseNumber}`);
        }

    } catch (error) {
        console.error(`[API Save] Error:`, error.message);
    }
}

/**
 * Logic to process a single case type indefinitely until stop condition.
 */
export async function processCaseType(browser, caseType, startNumber, caseYear) {
    let currentNum = startNumber;
    let consecutiveNotFound = 0;

    // Create a shared page
    let page = await browser.newPage();

    try {
        while (true) {
            const caseNumber = String(currentNum);

            // 1. Check Stop Condition
            if (consecutiveNotFound >= 5) {
                console.log(`[${caseType}] Stopping: 5 consecutive records not found.`);
                break;
            }

            console.log(`\n--- [${caseType}] Processing Case ${caseNumber} ---`);

            // 2. Check API (Idempotency)
            const { shouldSkip, nextCaseNumber } = await checkCaseStatus(caseType, caseNumber, caseYear);
            if (shouldSkip) {
                console.log(`[${caseType}] Skipping ${caseNumber}: Already exists in DB.`);

                if (nextCaseNumber && parseInt(nextCaseNumber) > currentNum) {
                    console.log(`[${caseType}] Jumping to ${nextCaseNumber} as suggested by API.`);
                    currentNum = parseInt(nextCaseNumber);
                } else {
                    currentNum++;
                }

                consecutiveNotFound = 0;
                continue;
            }

            // 3. Scrape
            // Pass the reusable PAGE object
            const result = await scrapeCaseInternal(page, {
                caseType,
                caseNumber,
                caseYear
            });

            // 4. Update Consecutive Count
            if (!result.success && result.error === "Record doesn't exist") {
                consecutiveNotFound++;
                console.warn(`[${caseType}] Record not found. Consecutive: ${consecutiveNotFound}`);
            } else if (result.success) {
                consecutiveNotFound = 0;
            }

            // If internal error occurred (not "Record doesn't exist"), it might be a page crash/timeout.
            // We should refresh the page object to be safe for the next run.
            if (!result.success && result.error !== "Record doesn't exist") {
                console.warn("Encountered unexpected error, recreating page...");
                try { await page.close(); } catch { }
                page = await browser.newPage();
            }

            // 5. Save Result
            await saveCaseResult(caseType, caseNumber, caseYear, result);

            // Move to next
            currentNum++;
        }
    } finally {
        if (page) await page.close();
    }
}

/**
 * Main Worker Entrypoint
 */
async function runWorkerScript() {
    // Only run if called directly
    if (process.argv[1] && process.argv[1].endsWith('worker.js')) {
        // Parse args: node worker.js <caseType> <startNumber> <year>
        const args = process.argv.slice(2);

        // If args are missing, do not run (could be imported)
        if (args.length < 3) return;

        const [caseType, startNumberStr, caseYear] = args;
        const startNumber = parseInt(startNumberStr, 10);

        console.log(`Starting Worker for ${caseType} / ${caseYear} from #${startNumber}`);

        // Launch Browser
        const browser = await chromium.launch({
            headless: process.env.HEADLESS !== "false",
            slowMo: 100
        });

        try {
            await processCaseType(browser, caseType, startNumber, caseYear);
        } catch (err) {
            console.error("Worker Fatal Error:", err);
        } finally {
            await browser.close();
            console.log("Worker finished.");
        }
    }
}

runWorkerScript();
