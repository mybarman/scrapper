import express from "express";
import { scrapeCase, scrapeMultiple } from "./core.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get("/", (req, res) => {
    res.send("Scraper API is running. POST to /scrape to start.");
});

app.post("/scrape", async (req, res) => {
    const { caseType, caseNumber, caseYear } = req.body;

    if (!caseType || !caseNumber || !caseYear) {
        return res.status(400).json({
            success: false,
            error: "Missing required parameters: caseType, caseNumber, caseYear"
        });
    }

    console.log(`[API] Received scrape request for ${caseType}/${caseNumber}/${caseYear}`);

    // Run the scraper
    // Note: depending on load, you might want to run this in a queue in the future.
    const result = await scrapeCase({ caseType, caseNumber, caseYear });

    if (result.success) {
        return res.json(result);
    } else {
        return res.status(500).json(result);
    }
});

app.post("/scrape-multiple", async (req, res) => {
    const { caseType, caseNumber, caseYear, numberOfCases } = req.body;

    if (!caseType || !caseNumber || !caseYear || !numberOfCases) {
        return res.status(400).json({
            success: false,
            error: "Missing required parameters: caseType, caseNumber, caseYear, numberOfCases"
        });
    }

    console.log(`[API] Received multi-scrape request for ${caseType}/${caseNumber} to +${numberOfCases}`);

    const results = await scrapeMultiple({ caseType, caseNumber, caseYear, numberOfCases });

    // Identify if completely failed or partially success?
    // We just return the array as requested.
    return res.json(results);
});

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
