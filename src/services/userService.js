import { collection, query, where, getDocs, setDoc, doc, getDoc, serverTimestamp, GeoPoint } from 'firebase/firestore';
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
    
    if (querySnapshot.empty) {
      console.log(`Phone number ${phoneNo} does not exist in any document.`);
      return false;
    }

    // Check if there is at least one active user (not deleted AND not blocked)
    const hasActiveUser = querySnapshot.docs.some(docSnap => {
      const data = docSnap.data();
      // An account counts as "existing" if it is active (not deleted and not blocked)
      return data.deleted !== true && data.block !== true;
    });

    console.log(`Phone number ${phoneNo} has an active account: ${hasActiveUser}`);
    return hasActiveUser;
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

  let latitude = 0.0;
  let longitude = 0.0;
  if (typeof window !== 'undefined' && window.localStorage) {
    try {
      const cachedLoc = window.localStorage.getItem('blithe_user_location');
      if (cachedLoc) {
        const parsed = JSON.parse(cachedLoc);
        if (parsed && typeof parsed.lat === 'number' && (typeof parsed.lng === 'number' || typeof parsed.longitude === 'number')) {
          latitude = parsed.lat;
          longitude = parsed.lng || parsed.longitude;
        }
      }
    } catch (e) {
      console.warn("Failed to retrieve cached location for new user creation:", e);
    }
  }

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
    geo: { 
      geohash: "", 
      geopoint: new GeoPoint(latitude, longitude)
    },
    instagramUrl: "",
    interests: {},
    isNotification: true,
    lastSeen: serverTimestamp(),
    lat: latitude,
    loginTime: serverTimestamp(),
    long: longitude,
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

/**
 * Updates user interests when a payment/booking succeeds.
 * Adds score to the user's category interests mapping, using the category ID.
 * @param {string} uid - User ID
 * @param {string} categoryNameOrId - Category name or ID
 * @param {number} score - Interest score to add (e.g. 5)
 */
export const updateUserInterests = async (uid, categoryNameOrId, score) => {
  console.log(`[Interests Debug] updateUserInterests called. uid: '${uid}', categoryNameOrId: '${categoryNameOrId}', score: ${score}`);
  try {
    if (!uid || !categoryNameOrId) {
      console.warn("[Interests Debug] Missing uid or categoryNameOrId:", { uid, categoryNameOrId });
      return;
    }

    let categoryId = categoryNameOrId;

    try {
      const categoriesRef = collection(db, 'eventCategories');
      const q = query(categoriesRef, where('deleted', '==', false));
      const querySnapshot = await getDocs(q);
      console.log(`[Interests Debug] Fetched ${querySnapshot.size} eventCategories.`);

      let foundIdByDocId = null;
      let foundIdByName = null;

      querySnapshot.forEach(docSnap => {
        const data = docSnap.data();
        const docId = docSnap.id;
        const name = data.categoryName || data.name || data.title || "";

        if (docId.toLowerCase() === categoryNameOrId.toLowerCase()) {
          foundIdByDocId = docId;
        }
        if (name.toLowerCase() === categoryNameOrId.toLowerCase()) {
          foundIdByName = docId;
        }
      });

      // Prefer matching by docId, then by name, fallback to categoryNameOrId
      categoryId = foundIdByDocId || foundIdByName || categoryNameOrId;
      console.log(`[Interests Debug] Resolved category ID: '${categoryId}' (original: '${categoryNameOrId}')`);
    } catch (catErr) {
      console.warn("[Interests Debug] Failed to resolve category ID from name/ID:", catErr);
    }

    const userDocRef = doc(db, 'users', uid);
    const userSnap = await getDoc(userDocRef);
    if (userSnap.exists()) {
      const userData = userSnap.data();
      const currentInterests = userData.interests || {};
      const newScore = (currentInterests[categoryId] || 0) + score;

      const updatedInterests = {
        ...currentInterests,
        [categoryId]: newScore
      };

      console.log(`[Interests Debug] Updating Firestore interests for user '${uid}':`, updatedInterests);
      await setDoc(userDocRef, {
        interests: updatedInterests
      }, { merge: true });
      console.log(`[Interests Debug] Successfully updated user '${uid}' interests for category '${categoryId}':`, updatedInterests);
    } else {
      console.warn(`[Interests Debug] User document not found in Firestore for uid: '${uid}'`);
    }
  } catch (err) {
    console.error("[Interests Debug] Failed to update user interests:", err);
  }
};
