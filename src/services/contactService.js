import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../firebase';

/**
 * Saves a contact message to the 'contact_messages' collection.
 * 
 * @param {Object} contactData 
 * @param {string} contactData.name - User's name
 * @param {string} contactData.email - User's email
 * @param {string} contactData.message - User's message
 * @returns {Promise<string>} The ID of the newly created document
 */
export const submitContactMessage = async (contactData) => {
  try {
    const docRef = await addDoc(collection(db, 'contact_messages'), {
      ...contactData,
      createdAt: serverTimestamp(),
      status: 'new' // Can be used for admin dashboard to track status
    });
    
    return docRef.id;
  } catch (error) {
    console.error("Error adding contact message: ", error);
    throw error;
  }
};
