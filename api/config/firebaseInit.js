import admin from "firebase-admin";
import fs from "fs";
const firebaseInit = async () => {
    try {
        let serviceAccount;
        if (process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON) {
            serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_JSON);
        } else {
            serviceAccount = JSON.parse(fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH, "utf8"));
        }
        admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
        console.log("FB init")
    } catch (err) {
        console.error(err.message);
        process.exit(1);
    }

}

export default firebaseInit;