import { solveCaptcha } from "../utils/ai.js";

/**
 * PHASE 1: Fill and submit the search form
 * Handles navigation, captcha solving, and form submission.
 */
export async function fillAndSubmitForm(page, { caseType, caseNumber, caseYear }) {
    await page.goto("https://hcservices.ecourts.gov.in/ecourtindiaHC/cases/case_no.php?state_cd=6&dist_cd=1&court_code=1&stateNm=Assam#", {
        waitUntil: "domcontentloaded",
        timeout: 60000
    });

    const maxRetries = 3;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        console.log(`[Attempt ${attempt}/${maxRetries}] Solving captcha and submitting form...`);

        await page.waitForSelector("#captcha_image");
        await page.waitForSelector("#case_type");

        // 1. Solve Captcha
        const base64Image = await page.evaluate(() => {
            const image = document.querySelector("#captcha_image");
            if (image) {
                const canvas = document.createElement("canvas");
                canvas.width = image.naturalWidth;
                canvas.height = image.naturalHeight;
                const ctx = canvas.getContext("2d");
                ctx.drawImage(image, 0, 0);
                return canvas.toDataURL("image/png");
            }
            return null;
        });

        const base64Data = base64Image ? base64Image.split(",")[1] : null;
        if (!base64Data) throw new Error("Failed to capture captcha image");

        const captchaText = await solveCaptcha(base64Data);
        console.log("Captcha Solution:", captchaText);
        await page.fill("#captcha", captchaText);

        // 2. Fill Form Details
        console.log(`Searching for Case Type: ${caseType}, Number: ${caseNumber}, Year: ${caseYear}`);
        await page.selectOption("#case_type", caseType);
        await page.waitForSelector("#search_case_no");
        await page.fill("#search_case_no", caseNumber);
        await page.waitForSelector("#rgyear");
        await page.fill("#rgyear", caseYear);

        // 3. Submit
        await page.getByRole("button", { name: "Go" }).click();

        // 4. Verify Outcome
        try {
            const outcome = await Promise.race([
                page.waitForSelector("#titlehid", { state: 'visible', timeout: 10000 }).then(() => "success"),
                page.waitForSelector('#txtmsg[title="Invalid Captcha"]', { state: 'visible', timeout: 10000 }).then(() => "captcha_failure"),
                page.waitForSelector('#txtmsg[title="Record Not Found"]', { state: 'visible', timeout: 10000 }).then(() => "record_not_found")
            ]);

            if (outcome === "success") {
                console.log("Form submitted successfully!");
                return; // Exit function on success
            } else if (outcome === "record_not_found") {
                console.error("Scraper Error: Record does not exist.");
                throw new Error("Record doesn't exist");
            } else if (outcome === "captcha_failure") {
                console.warn("Invalid Captcha detected. Retrying...");
                // Refresh captcha if needed
                const refreshBtn = await page.$('img[alt="Refresh Captcha"]');
                if (refreshBtn) await refreshBtn.click();

                await page.waitForTimeout(2000);
            }
        } catch (error) {
            // Rethrow specific errors
            if (error.message === "Record doesn't exist") throw error;

            // If timeout happens (neither success nor known failure), check where we are
            if (await page.locator("#titlehid").isVisible()) {
                console.log("Form submitted successfully (found table fallback)!");
                return;
            }
            console.warn("Unknown state after submit, retrying...", error.message);
        }
    }

    throw new Error(`Failed to submit form after ${maxRetries} attempts.`);
}
