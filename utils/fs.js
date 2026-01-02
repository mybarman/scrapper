import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import crypto from 'crypto';

/**
 * Creates a temporary file with the given content, passes the file path to the callback,
 * and ensures the file is deleted when the callback completes (success or failure).
 * 
 * @param {string|Buffer} content - The content to write to the file
 * @param {string} extension - File extension (e.g., ".pdf")
 * @param {function(string): Promise<void>} callback - Async function that receives the temp file path
 */
export async function withTempFile(content, extension, callback) {
    const tempDir = os.tmpdir();
    const uniqueId = crypto.randomBytes(16).toString('hex');
    const fileName = `scrape-${uniqueId}${extension || '.tmp'}`;
    const filePath = path.join(tempDir, fileName);

    try {
        await fs.writeFile(filePath, content);
        await callback(filePath);
    } finally {
        try {
            await fs.unlink(filePath);
        } catch (err) {
            // If the file doesn't exist, ignore (maybe callback deleted in it? though we shouldn't rely on that)
            // But if it's a permission error etc, log it.
            if (err.code !== 'ENOENT') {
                console.error(`Failed to delete temp file ${filePath}:`, err);
            }
        }
    }
}
