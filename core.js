import "dotenv/config";
import { chromium } from "playwright";
import { fillAndSubmitForm } from "./flows/form.js";
import { processSearchResults } from "./flows/list.js";

/**
 * Internal logic to scrape a single case using an existing browser instance.
 * Opens a new page, scrapes, and closes the page.
 */
async function scrapeCaseInternal(browser, { caseType, caseNumber, caseYear }) {
    const page = await browser.newPage();
    let result = { success: false, error: null };

    try {
        await fillAndSubmitForm(page, { caseType, caseNumber, caseYear });
        const { count, folderPath } = await processSearchResults(page, { caseType, caseNumber, caseYear });

        result = {
            success: true,
            message: "Scraping completed successfully",
            casesProcessed: count,
            folderPath
        };

    } catch (error) {
        console.error("Internal Log Error:", error);
        result = {
            success: false,
            error: error.message || "Unknown error occurred"
        };
    } finally {
        await page.close();
    }

    return result;
}

/**
 * Main scraper function - Single Case
 * Launches its own browser instance.
 * @param {Object} params
 * @param {string} params.caseType
 * @param {string} params.caseNumber
 * @param {string} params.caseYear
 */
export async function scrapeCase({ caseType, caseNumber, caseYear }) {
    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== "false",
        slowMo: 10
    });

    try {
        return await scrapeCaseInternal(browser, { caseType, caseNumber, caseYear });
    } finally {
        await browser.close();
    }
}

/**
 * Incremental scraper function
 * Scrapes N cases starting from a specific case number using a SHARED browser instance.
 * Stops if 5 consecutive "Record doesn't exist" errors are found.
 * @param {Object} params
 * @param {string} params.caseType
 * @param {string} params.caseNumber - Starting case number
 * @param {string} params.caseYear
 * @param {number} params.numberOfCases - Number of cases to scrape
 */
export async function scrapeMultiple({ caseType, caseNumber, caseYear, numberOfCases }) {
    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== "false",
        slowMo: 100
    });

    const results = [];
    const startNum = parseInt(caseNumber, 10);
    const limit = numberOfCases || 1;
    let consecutiveNotFound = 0;

    try {
        for (let i = 0; i < limit; i++) {
            // Stop if we have found 5 consecutive missing records
            if (consecutiveNotFound >= 5) {
                console.log(`Stopping incremental scrape: ${consecutiveNotFound} consecutive records not found.`);
                results.push({
                    success: false,
                    message: `Stopped after ${consecutiveNotFound} consecutive records not found.`,
                    info: "Autostop triggered"
                });
                break;
            }

            const currentCaseNum = String(startNum + i);
            console.log(`Starting incremental scrape (Shared Browser): ${currentCaseNum}`);

            // Call the internal scraper passing the shared browser
            const result = await scrapeCaseInternal(browser, {
                caseType,
                caseNumber: currentCaseNum,
                caseYear
            });

            // Logic to track consecutive not founds
            if (!result.success && result.error === "Record doesn't exist") {
                consecutiveNotFound++;
                console.warn(`Record not found for ${currentCaseNum}. Consecutive count: ${consecutiveNotFound}`);
            } else if (result.success) {
                consecutiveNotFound = 0;
            }

            // Append to results with the specific case number
            results.push({
                ...result,
                caseNumber: currentCaseNum
            });
        }
    } finally {
        await browser.close();
    }

    return results;
}
