const crypto = require("crypto");
const algorithm = "aes-256-cbc";
const key = 'password'; // Replace with a 32-byte key from a secure source

function encrypt(text) {
  let cipher = crypto.createCipher(algorithm, key);
  let encrypted = cipher.update(text, 'utf-8', 'hex') + cipher.final('hex');
  return encrypted.toString();
}

function decrypt(text) {
  let decipher = crypto.createDecipher(algorithm, key);
  let decrypted = decipher.update(text, 'hex', 'utf8') + decipher.final('utf8');
  return decrypted.toString();
}

module.exports = { encrypt, decrypt };
