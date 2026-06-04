import { collection, query, where, getDocs, setDoc, doc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase'; // Adjust this path if your firebase.js is located elsewhere

/**
 * Generates an array of search prefixes based on a given string.
 * @param {string} text - The input text (e.g., name or email)
 * @returns {string[]} An array of prefixes
 */
const createKeywords = (text) => {
  const arrName = [];
  let curName = '';
  text.split('').forEach((letter) => {
    curName += letter;
    arrName.push(curName.toUpperCase());
  });
  return arrName;
};

/**
 * Generates the setSearch array used for searching users.
 * @param {string} name - User's name
 * @param {string} email - User's email
 * @returns {string[]} An array of search keywords
 */
export const generateSearchKeywords = (name, email) => {
  const keywords = new Set();

  // Basic prefixes for name parts
  const nameParts = name.toUpperCase().split(' ');
  nameParts.forEach(part => {
    createKeywords(part).forEach(kw => keywords.add(kw));
  });

  // Prefixes for full name
  createKeywords(name.toUpperCase()).forEach(kw => keywords.add(kw));

  // Prefixes for email
  createKeywords(email.toUpperCase()).forEach(kw => keywords.add(kw));

  // Prefixes for email + name combination (as seen in the example)
  createKeywords(`${email.toUpperCase()} ${name.toUpperCase()}`).forEach(kw => keywords.add(kw));

  return Array.from(keywords);
};

/**
 * Generates a custom User ID in the format BLU-<timestamp>-<random_up_to_999>
 * @returns {string} The generated UID
 */
export const generateUID = () => {
  const timestamp = Date.now();
  const randomNum = Math.floor(Math.random() * 1000);
  return `BLU-${timestamp}-${randomNum}`;
};

/**
 * Checks if a phone number already exists in the users collection.
 * @param {string} phoneNo - The phone number to check
 * @returns {Promise<boolean>} True if it exists, false otherwise
 */
export const checkPhoneExists = async (phoneNo) => {
  console.log(`Checking if phone number ${phoneNo} exists in database...`);
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('phoneNo', '==', phoneNo));
    const querySnapshot = await getDocs(q);
    console.log(`Phone number ${phoneNo} exists: ${!querySnapshot.empty}`);
    return !querySnapshot.empty;
  } catch (error) {
    console.error("Error checking phone number:", error);
    throw new Error("Failed to check phone number availability.");
  }
};

/**
 * Registers a new user if the phone number does not already exist.
 * @param {Object} userData - User details (name, email,    , password, etc.)
 * @returns {Promise<Object>} The created user data or throws an error
 */
/**
 * Creates a default user object with all required schema fields.
 */
export const createDefaultUserObject = (uid, name, email, phoneNo, otherData = {}) => {
  const setSearch = generateSearchKeywords(name || '', email || '');
  return {
    about: "Up for Event! Go Blithe",
    admin: false,
    block: false,
    countryCode: "91",
    countryShortName: "IN",
    createdTime: serverTimestamp(),
    dateOfBirth: null,
    daysOfStateOfMind: [1, 3, 5],
    deleted: false,
    email: email || "",
    facebookUrl: "",
    favoriteEvent: [],
    favoritePost: [],
    followRequest: [],
    followers: [],
    gender: "",
    geo: { geohash: "" },
    instagramUrl: "",
    interests: {},
    isNotification: true,
    lastSeen: serverTimestamp(),
    lat: 0.0,
    loginTime: serverTimestamp(),
    long: 0.0,
    macAddress: "",
    name: name || "",
    oid: "",
    online: true,
    optOut: false,
    orgFollowers: [],
    orgPostNoti: [],
    orgViewers: [],
    organiser: false,
    participant: {},
    password: "",
    phoneNo: phoneNo,
    phoneVerified: false,
    otpLogin: false,
    private: false,
    profilePic: "",
    qrCode: "",
    reference: doc(db, 'users', uid),
    setSearch: setSearch,
    token: [],
    uid: uid,
    userConnect: [],
    userPostNoti: [],
    viewers: [],
    subscribedTopic: "",
    ...otherData
  };
};

export const registerNewUser = async (userData) => {
  console.log("Attempting to register new user with data:", userData);
  const { name, email, phoneNo, password, gender, dateOfBirth, countryCode, countryShortName } = userData;

  if (!phoneNo) {
    console.error("Registration failed: Phone number is required");
    throw new Error("Phone number is required");
  }

  // 1. Check if phone number already exists
  const phoneExists = await checkPhoneExists(phoneNo);
  if (phoneExists) {
    console.warn(`Registration failed: Phone number ${phoneNo} already exists`);
    throw new Error("A user with this mobile number already exists.");
  }

  // 2. Prepare the new user document data
  const uid = generateUID();
  console.log(`Generated new UID: ${uid}`);

  const newUserDocument = createDefaultUserObject(uid, name, email, phoneNo, {
    password: password || "",
    gender: gender || "",
    countryCode: countryCode || "91",
    countryShortName: countryShortName || "IN",
    dateOfBirth: dateOfBirth ? new Date(dateOfBirth) : null
  });

  // 3. Save the document to Firestore using the custom UID
  try {
    console.log(`Saving user document for UID ${uid} to Firestore...`);
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, newUserDocument);
    console.log("Successfully created user document in Firestore:", newUserDocument);
    return newUserDocument;
  } catch (error) {
    console.error("Error creating new user:", error);
    throw new Error("Failed to register new user.");
  }
};
