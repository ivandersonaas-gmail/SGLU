
async function checkServer() {
    const url = 'http://localhost:3000';
    try {
        console.log(`Checking ${url}...`);
        const response = await fetch(url);
        console.log(`Result: Status ${response.status}`);
        if (response.ok) {
            console.log("✅ Server is UP and accessible!");
        } else {
            console.log("⚠️ Server responded with error status.");
        }
    } catch (e) {
        console.error("❌ Connection failed:", e.message);
    }
}
checkServer();
