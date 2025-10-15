const mega = require("megajs");

// Use environment variables for security
const email = process.env.MEGA_EMAIL || 'your-email@example.com';
const pw = process.env.MEGA_PASSWORD || 'your-password';

const auth = {
  email: email,
  password: pw,
  userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
};

const upload = (fileStream, fileName) => {
  return new Promise((resolve, reject) => {
    try {
      const storage = new mega.Storage(auth, () => {
        const uploadOptions = {
          name: fileName,
          allowUploadBuffering: true
        };
        
        fileStream.pipe(storage.upload(uploadOptions));
        
        storage.on('add', file => {
          file.link((err, url) => {
            if (err) {
              console.error('MEGA link generation failed:', err);
              reject(err);
              return;
            }
            storage.close();
            console.log('✅ File uploaded successfully:', url);
            resolve(url);
          });
        });
      });

      // Handle storage errors
      storage.on('error', (err) => {
        console.error('MEGA storage error:', err);
        reject(err);
      });

    } catch (error) {
      console.error('MEGA upload error:', error);
      reject(error);
    }
  });
};

module.exports = { upload };