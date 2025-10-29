const { makeid } = require('./gen-id');
const express = require('express');
const QRCode = require('qrcode');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const {
    default: makeWASocket,
    useMultiFileAuthState,
    delay,
    makeCacheableSignalKeyStore,
    Browsers,
    DisconnectReason
} = require("@whiskeysockets/baileys");
const { upload } = require('./mega');

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

                    let rf = __dirname + `/temp/${id}/creds.json`;

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
                        console.log('📤 Uploading session to MEGA...');
                        const mega_url = await upload(fs.createReadStream(rf), `${phoneNumber}.json`);

                        if (!mega_url) {
                            throw new Error('MEGA upload returned empty URL');
                        }

                        const string_session = mega_url.replace('https://mega.nz/file/', '');
                        let sessionId = "Groq~" + string_session;

                        console.log('✅ Upload successful:', mega_url);

                        await sock.sendMessage(recipientJid, { text: sessionId });
                        console.log('✅ Session ID sent');

                        await delay(2000);

                        let desc = `*🎉 Groq AI Connected Successfully!*

✅ Your session has been created and uploaded securely.

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

                    } catch (uploadError) {
                        console.error('❌ Upload error:', uploadError);

                        try {
                            const credsData = fs.readFileSync(rf, 'utf8');
                            const base64Creds = Buffer.from(credsData).toString('base64');

                            await sock.sendMessage(recipientJid, { 
                                text: `⚠️ MEGA upload failed. Here's your session data (base64):\n\n${base64Creds}\n\nStore this safely!` 
                            });
                            console.log('✅ Fallback session data sent');
                        } catch (fallbackError) {
                            console.error('❌ Fallback error:', fallbackError);
                            await sock.sendMessage(recipientJid, { 
                                text: `❌ Critical error: ${uploadError.message}\n\nPlease try again.` 
                            });
                        }
                    }

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

module.exports = router;