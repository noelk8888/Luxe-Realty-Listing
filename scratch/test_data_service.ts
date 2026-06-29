import { fetchListings } from '../src/services/dataService';

async function run() {
    console.log("Starting fetchListings...");
    try {
        const results = await fetchListings();
        console.log("Success! Length:", results.length);
    } catch(e) {
        console.error("Error:", e);
    }
    process.exit(0);
}
run();
