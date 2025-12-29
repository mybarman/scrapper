import "dotenv/config";
import { renameFolder } from "./utils/storage.js";

const [oldFolder, newFolder] = process.argv.slice(2);

if (!oldFolder || !newFolder) {
    console.error("Usage: node rename_folder.js <old_folder_path> <new_folder_path>");
    console.error("Example: node rename_folder.js AB/123 AB_Anticipatory_Bail_49/123");
    process.exit(1);
}

await renameFolder(oldFolder, newFolder);
