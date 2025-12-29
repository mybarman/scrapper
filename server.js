import express from "express";
import { scrapeCase } from "./core.js";

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

app.listen(PORT, () => {
    console.log(`Server running at http://localhost:${PORT}`);
});
