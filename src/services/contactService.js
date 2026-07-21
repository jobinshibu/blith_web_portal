import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

/**
 * Submits a contact message via the Firebase Cloud Function sendContactEmail.
 * 
 * @param {Object} contactData 
 * @param {string} contactData.name - User's name
 * @param {string} contactData.email - User's email
 * @param {string} contactData.message - User's message
 * @returns {Promise<Object>} The Cloud Function response data
 */
export const submitContactMessage = async (contactData) => {
  try {
    const sendContactEmail = httpsCallable(functions, "sendContactEmail");
    const result = await sendContactEmail(contactData);
    return result.data;
  } catch (error) {
    console.error("Error in submitContactMessage service:", error);
    throw error;
  }
};
