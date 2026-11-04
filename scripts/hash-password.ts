// Prints a bcrypt hash, e.g. to set an admin password directly in the database.
// Usage: npm run admin:hash -- "a long passphrase"
import bcrypt from "bcryptjs";

const pw = process.argv[2];
if (!pw || pw.length < 12) {
  console.error("Provide a password of at least 12 characters.");
  process.exit(1);
}
console.log(bcrypt.hashSync(pw, 12));
