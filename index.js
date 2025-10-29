require("dotenv").config();  // Load .env variables
const { Client, MessageMedia } = require("whatsapp-web.js");

const express = require("express");
const fetch = require("node-fetch"); // Add this if not already imported
const qrcode = require("qrcode");  
const app = express();
app.use(express.json());
let qrCodeData = "";
const client = new Client();
const AUTH_USER =  process.env.WEB_USERNAME;
const AUTH_PASS = process.env.WEB_PASSWORD;

//client code
client.on("qr", async (qr) => {
    console.log("New QR received and scan this QR"); // Log only info
    qrCodeData = await qrcode.toDataURL(qr); // Convert to base64 image URL
});

app.use((req, res, next) => {
    const authHeader = req.headers.authorization;

    if (!authHeader) {
        res.setHeader("WWW-Authenticate", 'Basic realm="Restricted Area"');
        return res.status(401).send("Authentication required");
    }

    const base64Credentials = authHeader.split(" ")[1];
    const credentials = Buffer.from(base64Credentials, "base64").toString("ascii");
    const [username, password] = credentials.split(":");

    if (username === AUTH_USER && password === AUTH_PASS) {
        next(); // ✅ Correct — allow access
    } else {
        // 🔁 Force the browser to prompt again instead of “Access Denied”
        res.setHeader("WWW-Authenticate", 'Basic realm="Restricted Area"');
        return res.status(401).send("Invalid credentials. Try again.");
    }
});

app.get("/", (req, res) => {
    if (!qrCodeData) {
        return res.send("<h2>Waiting for QR code...</h2>");
    }
    res.send(`
        <html>
        <body style="text-align:center; margin-top:50px;">
            <h2>Scan this QR Code with your WhatsApp</h2>
            <img src="${qrCodeData}" alt="WhatsApp QR Code" />
        </body>
        </html>
    `);});







app.post("/send-invoice", async (req, res) => {
    try {
        const { number, orderId } = req.body;
        if (!number || !orderId) {
            return res.status(400).json({ error: "Missing number or orderId" });
        }

        const baseUrl = process.env.SPRINGBOOT_API_URL;
        const username = process.env.SPRINGBOOT_USERNAME;
        const password = process.env.SPRINGBOOT_PASSWORD;

        const apiUrl = `${baseUrl}/${orderId}/invoice?phone=${number}`;
        console.log(`Fetching invoice from: ${apiUrl}`);

        const authHeader = "Basic " + Buffer.from(`${username}:${password}`).toString("base64");

        const response = await fetch(apiUrl, {
            headers: { "Authorization": authHeader }
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch invoice (status ${response.status})`);
        }

        const buffer = await response.arrayBuffer();
        const media = new MessageMedia(
            "application/pdf",
            Buffer.from(buffer).toString("base64"),
            `invoice-${orderId}.pdf`
        );

        const whatsappNumber = number.startsWith("91") ? number + "@c.us" : "91" + number + "@c.us";
        await client.sendMessage(whatsappNumber, media);

        console.log(`✅ Invoice for order ${orderId} sent to ${number}`);
        res.json({ status: "success", message: `Invoice sent to ${number}` });

    } catch (err) {
        console.error("❌ Error:", err.message);
        res.status(500).json({ status: "error", error: err.message });
    }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
    console.log(`🚀 WhatsApp sender service running on port ${PORT}`);
});

client.initialize();
