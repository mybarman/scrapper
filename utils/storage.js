import { put, list, copy, del } from "@vercel/blob";

/**
 * Uploads a file fetched from a URL (via the page context) to Vercel Blob.
 */
export async function uploadUrlToVercel(page, href, uploadPath) {
    const url = new URL(href, page.url()).toString();
    const res = await page.request.get(url);

    if (!res.ok()) throw new Error(`Fetch failed ${res.status()} ${url}`);

    const buf = await res.body();

    console.log(`Uploading URL content to: ${uploadPath}...`);
    const { url: blobUrl } = await put(uploadPath, buf, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true
    });
    console.log(`Uploaded successfully: ${blobUrl}`);
    return blobUrl;
}

/**
 * Uploads raw string or buffer content to Vercel Blob.
 */
export async function uploadContentToVercel(content, uploadPath) {
    console.log(`Uploading raw content to: ${uploadPath}...`);
    const { url: blobUrl } = await put(uploadPath, content, {
        access: 'public',
        token: process.env.BLOB_READ_WRITE_TOKEN,
        allowOverwrite: true
    });
    console.log(`Uploaded successfully: ${blobUrl}`);
    return blobUrl;
}

/**
 * Renames a "folder" in Vercel Blob by copying all files to the new prefix and deleting the old ones.
 * @param {string} oldPrefix - The old folder path (e.g., "AB/123")
 * @param {string} newPrefix - The new folder path (e.g., "AB_Anticipatory_Bail_49/123")
 */
export async function renameFolder(oldPrefix, newPrefix) {
    console.log(`Renaming folder from '${oldPrefix}' to '${newPrefix}'...`);

    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
        // List blobs in the old folder
        const { blobs, hasMore: more, cursor: nextCursor } = await list({
            prefix: oldPrefix,
            cursor,
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        hasMore = more;
        cursor = nextCursor;

        for (const blob of blobs) {
            // New pathname: replace the old prefix with new prefix
            // We need to be careful to only replace the start
            const relativePath = blob.pathname.slice(oldPrefix.length);
            // Ensure we handle trailing slashes correctly
            const cleanNewPrefix = newPrefix.endsWith('/') ? newPrefix.slice(0, -1) : newPrefix;
            const cleanRelative = relativePath.startsWith('/') ? relativePath : '/' + relativePath;

            const newPathname = cleanNewPrefix + cleanRelative;

            console.log(`Moving: ${blob.pathname} -> ${newPathname}`);

            try {
                // 1. Copy to new location
                await copy(blob.url, newPathname, {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN
                });

                // 2. Delete old file
                await del(blob.url, {
                    token: process.env.BLOB_READ_WRITE_TOKEN
                });
            } catch (err) {
                console.error(`Failed to move ${blob.pathname}:`, err);
            }
        }
    }

    console.log(`Folder rename complete.`);
}

/**
 * Copies a "folder" in Vercel Blob to a new prefix without deleting the original.
 * @param {string} sourcePrefix - The source folder path
 * @param {string} targetPrefix - The target folder path
 */
export async function copyFolder(sourcePrefix, targetPrefix) {
    console.log(`Copying folder from '${sourcePrefix}' to '${targetPrefix}'...`);

    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
        const { blobs, hasMore: more, cursor: nextCursor } = await list({
            prefix: sourcePrefix,
            cursor,
            token: process.env.BLOB_READ_WRITE_TOKEN
        });

        hasMore = more;
        cursor = nextCursor;

        for (const blob of blobs) {
            const relativePath = blob.pathname.slice(sourcePrefix.length);
            const cleanNewPrefix = targetPrefix.endsWith('/') ? targetPrefix.slice(0, -1) : targetPrefix;
            const cleanRelative = relativePath.startsWith('/') ? relativePath : '/' + relativePath;

            const newPathname = cleanNewPrefix + cleanRelative;

            console.log(`Copying: ${blob.pathname} -> ${newPathname}`);

            try {
                await copy(blob.url, newPathname, {
                    access: 'public',
                    token: process.env.BLOB_READ_WRITE_TOKEN
                });
            } catch (err) {
                console.error(`Failed to copy ${blob.pathname}:`, err);
            }
        }
    }
    console.log(`Folder copy complete.`);
}

/**
 * Deletes a "folder" in Vercel Blob by deleting all files with the given prefix.
 * @param {string} prefix - The folder path to delete (e.g., "AB/123")
 */
export async function deleteFolder(prefix) {
    console.log(`Deleting folder '${prefix}'...`);

    let hasMore = true;
    let cursor = undefined;

    while (hasMore) {
        try {
            const listResult = await list({
                prefix: prefix,
                cursor,
                token: process.env.BLOB_READ_WRITE_TOKEN
            });

            const urls = listResult.blobs.map(b => b.url);
            if (urls.length > 0) {
                console.log(`Deleting ${urls.length} files...`);
                await del(urls, {
                    token: process.env.BLOB_READ_WRITE_TOKEN
                });

                // Add a small delay to avoid rate limits
                await new Promise(r => setTimeout(r, 1000));
            }

            // Only update cursor if everything succeeded
            hasMore = listResult.hasMore;
            cursor = listResult.cursor;

        } catch (err) {
            if (err.retryAfter) {
                const waitSecs = err.retryAfter;
                console.warn(`Rate limited. Waiting for ${waitSecs} seconds...`);
                await new Promise(r => setTimeout(r, (waitSecs + 1) * 1000));
                // Loop continues with same cursor
            } else {
                console.error("Error during deletion:", err);
                throw err;
            }
        }
    }
    console.log(`Folder deletion complete.`);
}
