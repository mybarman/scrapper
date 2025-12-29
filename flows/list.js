import { processCaseOrders } from "./details.js";
import { uploadContentToVercel } from "../utils/storage.js";

/**
 * PHASE 2: specific case list processing
 * Iterates through the table of results and processes each case.
 */
export async function processSearchResults(page, { caseType, caseNumber, caseYear }) {
    await page.waitForSelector("#titlehid tbody#showList1 tr");
    const rows = page.locator("#titlehid tbody#showList1 tr");
    const count = await rows.count();

    console.log(`Found ${count} cases to process.`);

    let folderUrl = null;

    for (let i = 0; i < count; i++) {
        const row = page.locator("#titlehid tbody#showList1 tr").nth(i);

        // Column 0: Sr No
        const srNo = (await row.locator("td").nth(0).innerText()).trim();

        // Column 1: Case Type/Case Number/Case Year
        const caseRef = (await row.locator("td").nth(1).innerText()).trim();

        // Column 2: Petitioner vs Respondent
        const partyNames = (await row.locator("td").nth(2).innerText()).replace(/\s+/g, " ").trim();

        console.log(`Processing Case ${i + 1}/${count} [SrNo: ${srNo}]: ${caseRef} | ${partyNames}`);

        // Upload Row HTML
        const rowHtml = await row.evaluate(el => el.outerHTML);
        const parts = caseRef.split("/");
        // Use input caseType for correct folder structure
        const number = parts[1] || "UnknownNumber";
        const rowUrl = await uploadContentToVercel(rowHtml, `${caseType}/y-${caseYear}/${number}/${srNo}/row.html`);

        // Derive root folder path (once) from the first upload
        // Structure: caseType/y-year/number
        if (!folderUrl) {
            folderUrl = `${caseType}/y-${caseYear}/${number}`;
        }

        // Navigate to details
        await row.getByRole("link", { name: "View" }).click();

        // Process the orders (Phase 3)
        await processCaseOrders(page, caseRef, srNo, { caseType, caseNumber, caseYear });

        // Go back to list
        await page.locator('#back_top a[onclick*="funBack"]').click();
        await page.waitForSelector("#titlehid tbody#showList1 tr");
    }

    return { count, folderPath: folderUrl };
}
