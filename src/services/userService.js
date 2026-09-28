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
 * Checks if an email already exists in the users collection.
 * @param {string} email - The email to check
 * @returns {Promise<boolean>} True if it exists, false otherwise
 */
export const checkEmailExists = async (email) => {
  console.log(`Checking if email ${email} exists in database...`);
  try {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('email', '==', email));
    const querySnapshot = await getDocs(q);
    
    if (querySnapshot.empty) {
      console.log(`Email ${email} does not exist in any document.`);
      return false;
    }

    // Check if there is at least one active user (not deleted AND not blocked)
    const hasActiveUser = querySnapshot.docs.some(docSnap => {
      const data = docSnap.data();
      return data.deleted !== true && data.block !== true;
    });

    console.log(`Email ${email} has an active account: ${hasActiveUser}`);
    return hasActiveUser;
  } catch (error) {
    console.error("Error checking email:", error);
    throw new Error("Failed to check email availability.");
  }
};

/**
 * Encodes a latitude and longitude into a geohash string.
 * @param {number} latitude 
 * @param {number} longitude 
 * @param {number} precision - Length of the geohash (defaults to 9)
 * @returns {string} The geohash string
 */
export const encodeGeohash = (latitude, longitude, precision = 9) => {
  if (typeof latitude !== 'number' || typeof longitude !== 'number' || isNaN(latitude) || isNaN(longitude)) {
    return "";
  }
  const lat = Math.max(-90.0, Math.min(90.0, latitude));
  const lng = Math.max(-180.0, Math.min(180.0, longitude));

  const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
  let minLat = -90.0, maxLat = 90.0;
  let minLng = -180.0, maxLng = 180.0;
  let geohash = "";
  let isEven = true;
  let bit = 0;
  let ch = 0;

  while (geohash.length < precision) {
    let mid;
    if (isEven) {
      mid = (minLng + maxLng) / 2.0;
      if (lng > mid) {
        ch |= (1 << (4 - bit));
        minLng = mid;
      } else {
        maxLng = mid;
      }
    } else {
      mid = (minLat + maxLat) / 2.0;
      if (lat > mid) {
        ch |= (1 << (4 - bit));
        minLat = mid;
      } else {
        maxLat = mid;
      }
    }

    isEven = !isEven;
    if (bit < 4) {
      bit++;
    } else {
      geohash += BASE32[ch];
      bit = 0;
      ch = 0;
    }
  }
  return geohash;
};

/**
 * Creates a default user object with all required schema fields.
 */
export const createDefaultUserObject = (uid, name, email, phoneNo, otherData = {}) => {
  const setSearch = generateSearchKeywords(name || '', email || '');

  let latitude = 0.0;
  let longitude = 0.0;
  if (typeof window !== 'undefined' && window.sessionStorage) {
    try {
      const cachedLoc = window.sessionStorage.getItem('blithe_user_location');
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

  const geohashVal = (latitude !== 0.0 || longitude !== 0.0) ? encodeGeohash(latitude, longitude) : "";

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
      geohash: geohashVal, 
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
    platform: "web",
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

  if (!name || name.trim() === "") {
    console.error("Registration failed: Name is required");
    throw new Error("Name is required");
  }

  if (!email || email.trim() === "") {
    console.error("Registration failed: Email is required");
    throw new Error("Email is required");
  }

  if (!phoneNo || phoneNo.trim() === "") {
    console.error("Registration failed: Phone number is required");
    throw new Error("Phone number is required");
  }

  // 1. Check if phone number already exists
  const phoneExists = await checkPhoneExists(phoneNo);
  if (phoneExists) {
    console.warn(`Registration failed: Phone number ${phoneNo} already exists`);
    throw new Error("A user with this mobile number already exists.");
  }

  // 1.5. Check if email already exists
  const emailExists = await checkEmailExists(email);
  if (emailExists) {
    console.warn(`Registration failed: Email ${email} already exists`);
    throw new Error("A user with this email address already exists.");
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
// In-memory cache for event categories mapping to minimize Firestore reads
let cachedUserCategories = null;
let lastUserCategoriesFetchTime = 0;
const USER_CATEGORIES_CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export const updateUserInterests = async (uid, categoryNameOrId, score) => {
  console.log(`[Interests Debug] updateUserInterests called. uid: '${uid}', categoryNameOrId: '${categoryNameOrId}', score: ${score}`);
  try {
    if (!uid || !categoryNameOrId) {
      console.warn("[Interests Debug] Missing uid or categoryNameOrId:", { uid, categoryNameOrId });
      return;
    }

    let categoryId = categoryNameOrId;

    try {
      const now = Date.now();
      let categoryList = [];

      if (cachedUserCategories && (now - lastUserCategoriesFetchTime < USER_CATEGORIES_CACHE_TTL)) {
        categoryList = cachedUserCategories;
      } else {
        const categoriesRef = collection(db, 'eventCategories');
        const q = query(categoriesRef, where('deleted', '==', false));
        const querySnapshot = await getDocs(q);
        categoryList = querySnapshot.docs.map(docSnap => ({
          id: docSnap.id,
          name: docSnap.data().categoryName || docSnap.data().name || docSnap.data().title || ""
        }));
        cachedUserCategories = categoryList;
        lastUserCategoriesFetchTime = now;
        console.log(`[Interests Debug] Fetched and cached ${categoryList.length} eventCategories.`);
      }

      let foundIdByDocId = null;
      let foundIdByName = null;

      categoryList.forEach(item => {
        const docId = item.id;
        const name = item.name;

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

/**
 * Soft deletes a customer/user account in Firestore.
 * Sets deleted: true, records the timestamp, and clears active session tokens.
 * @param {string} uid - User ID
 * @returns {Promise<boolean>}
 */
export const softDeleteUser = async (uid) => {
  if (!uid) {
    throw new Error("User ID is required for account deletion.");
  }
  console.log(`[userService] Initiating soft delete for user: ${uid}`);
  try {
    const userDocRef = doc(db, 'users', uid);
    await setDoc(userDocRef, {
      deleted: true,
      deletedAt: serverTimestamp(),
      online: false,
      token: []
    }, { merge: true });
    console.log(`[userService] Successfully soft-deleted user: ${uid}`);
    return true;
  } catch (error) {
    console.error("[userService] Error during soft deletion of user:", error);
    throw new Error("Failed to delete account. Please try again later.");
  }
};

/**
 * Looks up an active (non-deleted, non-blocked) user by registered email or mobile number.
 * @param {string} identifier - Email or phone number string
 * @returns {Promise<Object|null>}
 */
export const findActiveUserByIdentifier = async (identifier) => {
  if (!identifier || !identifier.trim()) {
    throw new Error("Please enter your registered mobile number or email address.");
  }
  const cleaned = identifier.trim();
  const usersRef = collection(db, 'users');

  // 1. Search by email
  try {
    const emailQuery = query(usersRef, where('email', '==', cleaned));
    const emailSnap = await getDocs(emailQuery);
    const activeEmailDoc = emailSnap.docs.find(d => {
      const data = d.data();
      return data.deleted !== true && data.block !== true;
    });
    if (activeEmailDoc) {
      return { uid: activeEmailDoc.id, ...activeEmailDoc.data() };
    }
  } catch (e) {
    console.warn("[userService] Error searching user by email:", e);
  }

  // 2. Search by phone number variants
  try {
    const digitsOnly = cleaned.replace(/\D/g, '');
    const last10 = digitsOnly.slice(-10);
    const phoneVariants = Array.from(new Set([
      cleaned,
      digitsOnly,
      last10,
      `+91${last10}`,
      `91${last10}`,
      `0${last10}`
    ])).filter(Boolean);

    for (const p of phoneVariants) {
      const phoneQuery = query(usersRef, where('phoneNo', '==', p));
      const phoneSnap = await getDocs(phoneQuery);
      const activePhoneDoc = phoneSnap.docs.find(d => {
        const data = d.data();
        return data.deleted !== true && data.block !== true;
      });
      if (activePhoneDoc) {
        return { uid: activePhoneDoc.id, ...activePhoneDoc.data() };
      }
    }
  } catch (e) {
    console.warn("[userService] Error searching user by phone:", e);
  }

  return null;
};

