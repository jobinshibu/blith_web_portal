/**
 * Service to handle OTP sending and verification via MSG91 Firebase Cloud Functions.
 * Matches the mobile app implementation (httpsCallable: 'sendOTP' & 'verifyOTP').
 */

/**
 * Dynamically retrieves the Firebase Cloud Functions instance.
 */
const getFunctionsInstance = async () => {
  const [{ getFunctions }, { app }] = await Promise.all([
    import("firebase/functions"),
    import("../firebase")
  ]);
  return getFunctions(app);
};

/**
 * Sends OTP to a phone number using the 'sendOTP' Firebase Cloud Function.
 * 
 * @param {Object} params
 * @param {string} params.phoneNumber - 10-digit mobile number
 * @param {string} [params.countryCode="91"] - Country calling code without '+'
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const sendOtpMsg91 = async ({ phoneNumber, countryCode = "91" }) => {
  try {
    const cleanPhone = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
    const cleanCountry = String(countryCode || '91').replace(/\D/g, '') || '91';

    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new Error("Please provide a valid 10-digit mobile number.");
    }

    const [{ httpsCallable }, functions] = await Promise.all([
      import("firebase/functions"),
      getFunctionsInstance()
    ]);

    const sendOTPCallable = httpsCallable(functions, "sendOTP");
    const result = await sendOTPCallable({
      phoneNumber: cleanPhone,
      countryCode: cleanCountry,
    });

    const data = result?.data || {};
    if (data.success === true) {
      return { success: true, message: data.message || "OTP sent successfully." };
    } else {
      throw new Error(data.message || "Failed to send OTP.");
    }
  } catch (error) {
    console.error("[otpService] Error in sendOtpMsg91:", error);
    const message = error?.message || error?.details || "Failed to send OTP. Please try again.";
    throw new Error(message);
  }
};

/**
 * Verifies OTP for a phone number using the 'verifyOTP' Firebase Cloud Function.
 * 
 * @param {Object} params
 * @param {string} params.phoneNumber - 10-digit mobile number
 * @param {string} [params.countryCode="91"] - Country calling code without '+'
 * @param {string} params.otp - Entered OTP digits
 * @returns {Promise<{success: boolean, message: string}>}
 */
export const verifyOtpMsg91 = async ({ phoneNumber, countryCode = "91", otp }) => {
  try {
    const cleanPhone = String(phoneNumber || '').replace(/\D/g, '').slice(-10);
    const cleanCountry = String(countryCode || '91').replace(/\D/g, '') || '91';
    const cleanOtp = String(otp || '').trim();

    if (!cleanPhone || cleanPhone.length !== 10) {
      throw new Error("Invalid mobile number.");
    }
    if (!cleanOtp) {
      throw new Error("Please enter the OTP received.");
    }

    const [{ httpsCallable }, functions] = await Promise.all([
      import("firebase/functions"),
      getFunctionsInstance()
    ]);

    const verifyOTPCallable = httpsCallable(functions, "verifyOTP");
    const result = await verifyOTPCallable({
      phoneNumber: cleanPhone,
      countryCode: cleanCountry,
      otp: cleanOtp,
    });

    const data = result?.data || {};
    if (data.success === true) {
      return { success: true, message: data.message || "OTP verified successfully." };
    } else {
      throw new Error(data.message || "Invalid OTP.");
    }
  } catch (error) {
    console.error("[otpService] Error in verifyOtpMsg91:", error);
    const message = error?.message || error?.details || "Invalid OTP or verification failed.";
    throw new Error(message);
  }
};
