import { uploadUrlToVercel, uploadContentToVercel } from "../utils/storage.js";

/**
 * PHASE 3: Process the orders for a specific case
 * Extracts order details and uploads PDFs to Vercel.
 */
export async function processCaseOrders(page, caseRef, srNo, { caseType, caseYear }) {
    await page.waitForSelector("#secondpage table.order_table");

    const parsed = await page.evaluate(() => {
        const root = document.querySelector("#secondpage");
        const form = document.querySelector('form[name="frm"]');
        const detailsHtml = form ? form.innerHTML : ""; // Capture form inner HTML

        const text = (el) => (el?.textContent || "").replace(/\s+/g, " ").trim();

        const cnrEl = Array.from(root.querySelectorAll(".case_details_table"))
            .find(x => text(x).includes("CNR Number"));
        const cnr = cnrEl ? text(cnrEl).split(":").pop().trim() : null;

        const orderRows = Array.from(root.querySelectorAll("table.order_table tbody tr")).slice(1);
        const orders = orderRows.map(tr => {
            const tds = tr.querySelectorAll("td");
            return {
                orderNumber: text(tds[0]).replace(/[^\d]/g, ""),
                orderDate: text(tds[3]),
                pdfHref: tr.querySelector('a[href*="display_pdf.php"]')?.getAttribute("href") || null
            };
        });

        return { cnr, orders, detailsHtml };
    });

    // Upload Case Details HTML
    const parts = caseRef.split("/");
    // use input caseType
    const number = parts[1] || "UnknownNumber";

    if (parsed.detailsHtml) {
        await uploadContentToVercel(parsed.detailsHtml, `${caseType}/y-${caseYear}/${number}/${srNo}/Details/case_details.html`);
    }

    // Sort orders by date descending to find the latest
    // Date format usually DD-MM-YYYY
    const sortedOrders = parsed.orders.sort((a, b) => {
        const parseDate = (d) => {
            if (!d) return 0;
            const [day, month, year] = d.split('-').map(Number);
            return new Date(year, month - 1, day).getTime();
        };
        return parseDate(b.orderDate) - parseDate(a.orderDate);
    });

    const latestOrder = sortedOrders[0];

    if (latestOrder && latestOrder.pdfHref) {
        // Path: Type / y-Year / Number/ SrNo_X / Date.pdf
        const safeDate = latestOrder.orderDate.replace(/[^a-zA-Z0-9-]/g, "_");
        const filePath = `${caseType}/y-${caseYear}/${number}/${srNo}/Orders/${safeDate}.pdf`;

        await uploadUrlToVercel(page, latestOrder.pdfHref, filePath);
    }
}
