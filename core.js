import "dotenv/config";
import { chromium } from "playwright";
import { fillAndSubmitForm } from "./flows/form.js";
import { processSearchResults } from "./flows/list.js";

/**
 * Main scraper function
 * @param {Object} params
 * @param {string} params.caseType
 * @param {string} params.caseNumber
 * @param {string} params.caseYear
 */
export async function scrapeCase({ caseType, caseNumber, caseYear }) {
    const browser = await chromium.launch({
        headless: process.env.HEADLESS !== "false",
        slowMo: 100
    });

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
        await browser.close();
    }

    return result;
}
