import "dotenv/config";
import { copyFolder } from "./utils/storage.js";

const [source, target] = process.argv.slice(2);

if (!source || !target) {
    console.error("Usage: node copy_folder.js <source_folder> <target_folder>");
    process.exit(1);
}

await copyFolder(source, target);
