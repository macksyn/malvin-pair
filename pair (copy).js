const { makeid } = require('./gen-id');
const express = require('express');
const fs = require('fs');
let router = express.Router();
const pino = require("pino");
const { 
    default: makeWASocket, 
    useMultiFileAuthState, 
    delay, 
    Browsers, 
    makeCacheableSignalKeyStore,
    DisconnectReason 
} = require('@whiskeysockets/baileys');

const { upload } = require('./mega');

function removeFile(FilePath) {
    if (!fs.existsSync(FilePath)) return false;
    fs.rmSync(FilePath, { recursive: true, force: true });
}

router.get('/', async (req, res) => {
    const id = makeid();
    let num = req.query.number;

    // Validate phone number
    if (!num || num.replace(/[^0-9]/g, '').length < 10) {
        return res.send({ code: "Invalid phone number" });
    }

    async function MALVIN_XD_PAIR_CODE() {
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

            // Request pairing code
            if (!sock.authState.creds.registered) {
                await delay(1500);
                num = num.replace(/[^0-9]/g, '');

                try {
                    const code = await sock.requestPairingCode(num);
                    console.log(`🔑 Pairing code for ${num}: ${code}`);

                    // Send code to user immediately
                    if (!res.headersSent) {
                        res.send({ code });
                    }
                } catch (err) {
                    console.error('Error requesting pairing code:', err);
                    if (!res.headersSent) {
                        res.send({ code: "Error generating code" });
                    }
                    await removeFile('./temp/' + id);
                    return;
                }
            }

            // Save credentials when updated
            sock.ev.on('creds.update', saveCreds);

            // Handle connection updates
            sock.ev.on("connection.update", async (update) => {
                const { connection, lastDisconnect } = update;

                console.log('Connection status:', connection);

                if (connection === "open") {
                    console.log('✅ Connected! User:', sock.user.id);

                    // Wait for connection to stabilize and creds to save
                    await delay(5000);

                    let rf = __dirname + `/temp/${id}/creds.json`;

                    // Check if file exists
                    if (!fs.existsSync(rf)) {
                        console.error('❌ Credentials file not found!');
                        await removeFile('./temp/' + id);
                        return;
                    }

                    // Extract phone number from sock.user.id (format: 2637147XXXXX:XX@s.whatsapp.net)
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

                        // Send session ID
                        await sock.sendMessage(recipientJid, { text: sessionId });
                        console.log('✅ Session ID sent');

                        // Wait a bit before sending the welcome message
                        await delay(2000);

                        // Send welcome message
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

                        // Fallback: send creds directly
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

                    // Clean up and close
                    await delay(3000);
                    await sock.ws.close();
                    await removeFile('./temp/' + id);

                } else if (connection === "close") {
                    const statusCode = lastDisconnect?.error?.output?.statusCode;
                    const reason = lastDisconnect?.error?.output?.payload?.error;

                    console.log('❌ Connection closed. Code:', statusCode, 'Reason:', reason);

                    // Don't reconnect if logged out or bad session
                    if (statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403) {
                        console.log('Authentication failed or logged out');
                        await removeFile('./temp/' + id);
                        return;
                    }

                    // Reconnect for other errors (but not for pairing timeout)
                    if (statusCode !== DisconnectReason.loggedOut && statusCode !== 428) {
                        console.log('🔄 Attempting to reconnect...');
                        await delay(2000);
                        MALVIN_XD_PAIR_CODE();
                    } else {
                        await removeFile('./temp/' + id);
                    }
                }
            });

            // Handle messaging errors
            sock.ev.on('messages.upsert', async () => {});

        } catch (err) {
            console.error("❌ Service error:", err.message);
            console.error(err.stack);
            await removeFile('./temp/' + id);

            if (!res.headersSent) {
                res.send({ code: "Service Error: " + err.message });
            }
        }
    }

    return await MALVIN_XD_PAIR_CODE();
});

module.exports = router;