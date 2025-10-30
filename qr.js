import { makeid } from './gen-id.js'; // Note: Added .js extension
import express from 'express';
import QRCode from 'qrcode';
import fs from 'fs';
import pino from "pino";
import path from 'path'; // Added for __dirname
import { fileURLToPath } from 'url'; // Added for __dirname

// 1. Converted Baileys import
import makeWASocket, {
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} from "@whiskeysockets/baileys";

// 2. Replaced __dirname
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

let router = express.Router();

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();

    async function MALVIN_XD_QR_CODE() {
        const {
            state,
            saveCreds
        } = await useMultiFileAuthState('./temp/' + id);

        try {
            let sock = makeWASocket({
                auth: {
                    creds: state.creds,
                    keys: makeCacheableSignalKeyStore(state.keys, pino({ level: "silent" }).child({ level: "silent" })),
                },
                printQRInTerminal: false,
                logger: pino({ level: "silent" }).child({ level: "silent" }),
                browser: Browsers.ubuntu("Chrome"),
                getMessage: async (key) => {
                    return { conversation: 'hello' }
                }
            });

            sock.ev.on('creds.update', saveCreds);

            sock.ev.on("connection.update", async (s) => {
                const {
                    connection,
                    lastDisconnect,
                    qr
                } = s;

                // Send QR code to browser
                if (qr) {
                    console.log('📱 QR Code generated');
                    if (!res.headersSent) {
                        try {
                            // 3. QRCode.toBuffer is correct
                            const qrImage = await QRCode.toBuffer(qr);
                            res.end(qrImage);
                        } catch (err) {
                            console.error('QR generation error:', err);
                        }
                    }
                }

                if (connection == "open") {
                    console.log('✅ Connected! User:', sock.user.id);

                    // Wait for connection to stabilize and creds to save
                    await delay(5000);

                    // 4. __dirname is now defined and will work here
                    let rf = path.join(__dirname, `temp/${id}/creds.json`);

                    if (!fs.existsSync(rf)) {
                        console.error('❌ Credentials file not found!');
                        await removeFile('./temp/' + id);
                        return;
                    }

                    // Extract phone number from sock.user.id
                    const phoneNumber = sock.user.id.split(':')[0];
                    const recipientJid = `${phoneNumber}@s.whatsapp.net`;

                    console.log('📱 Sending to:', recipientJid);

                    try {
                        console.log('📤 Preparing session data...');

                        // Read and encode credentials to base64
                        const credsData = fs.readFileSync(rf, 'utf8');
                        const base64Creds = Buffer.from(credsData).toString('base64');

                        // Create session ID with base64 prefix
                        let sessionId = "Groq~" + base64Creds;

                        console.log('✅ Session data prepared');

                        // Send session ID
                        await sock.sendMessage(recipientJid, { text: sessionId });
                        console.log('✅ Session ID sent');

                        // Wait a bit before sending the welcome message
                        await delay(2000);

                        // Send welcome message
                        let desc = `*🎉 Groq AI Connected Successfully!*

✅ Your session has been created and sent securely.

🔐 *Session ID:* See message above
⚠️ *KEEP IT PRIVATE!* Never share with anyone.

━━━━━━━━━━━━━━━━

📢 *Official Channel:*
https://whatsapp.com/channel/0029VbA6MSYJUM2TVOzCSb2A

💻 *Source Code:*
https://github.com/XdKing2/MALVIN-XD

━━━━━━━━━━━━━━━━
© Powered by Alex Macksyn`;

                        await sock.sendMessage(recipientJid, {
                            text: desc,
                            contextInfo: {
                                externalAdReply: {
                                    title: "MALVIN-XD Session Generator",
                                    body: "Session Created Successfully ✅",
                                    thumbnailUrl: "https://files.catbox.moe/bqs70b.jpg",
                                    sourceUrl: "https://whatsapp.com/channel/0029VbA6MSYJUM2TVOzCSb2A",
                                    mediaType: 1,
                                    renderLargerThumbnail: true
                                }
                            }
                        });

                        console.log(`✅ Welcome message sent to ${recipientJid}`);

                    } catch (sendError) {
                        console.error('❌ Error sending session:', sendError);

                        // Try to send error notification
                        try {
                            await sock.sendMessage(recipientJid, {
                                text: `❌ Critical error: ${sendError.message}\n\nPlease try again.`
                            });
                        } catch (notifyError) {
                            console.error('❌ Failed to send error notification:', notifyError);
                        }
                    }

                    // Clean up and close
                    await delay(3000);
                    await sock.ws.close();
                    await removeFile('./temp/' + id);

                } else if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;

                    console.log('❌ Connection closed. Code:', statusCode);

                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403 || statusCode === 428) {
                        console.log('Authentication failed or logged out or QR timeout');
                        await removeFile('./temp/' + id);
                        return;
                    }

                    if (statusCode !== DisconnectReason.loggedOut) {
                        console.log('🔄 Attempting to reconnect...');
                        await delay(2000);
                        MALVIN_XD_QR_CODE();
                    }
                }
            });

        } catch (err) {
            console.error("❌ Service error:", err.message);
            await removeFile('./temp/' + id);

            if (!res.headersSent) {
                res.send({ code: "Service Error: " + err.message });
            }
        }
    }

    await MALVIN_XD_QR_CODE();
});

// 5. Converted to export default
export default router;
