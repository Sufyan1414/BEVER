/**
 * BEVER Customer App — Phone Validation & Formatting Helpers
 *
 * Handles normalization, validation, E.164 formatting, and masking
 * for Indian mobile numbers (+91).
 */

export interface PhoneValidationResult {
  isValid: boolean;
  /** Full E.164 phone number e.g. "+919876543210" */
  formattedPhone: string;
  /** Clean 10-digit local number e.g. "9876543210" */
  localNumber: string;
  /** Human-readable error message if invalid */
  error?: string;
}

/**
 * Normalizes and validates an Indian mobile number.
 * Accepts 10-digit local numbers, numbers with leading 0 or +91 / 91.
 */
export function validateAndFormatIndianPhone(input: string): PhoneValidationResult {
  if (!input || input.trim() === '') {
    return {
      isValid: false,
      formattedPhone: '',
      localNumber: '',
      error: 'Please enter your phone number.',
    };
  }

  // Remove spaces, dashes, brackets, and leading plus
  const digitsOnly = input.replace(/\D/g, '');

  let localNumber = '';

  if (digitsOnly.length === 10) {
    localNumber = digitsOnly;
  } else if (digitsOnly.length === 12 && digitsOnly.startsWith('91')) {
    localNumber = digitsOnly.slice(2);
  } else if (digitsOnly.length === 11 && digitsOnly.startsWith('0')) {
    localNumber = digitsOnly.slice(1);
  } else {
    return {
      isValid: false,
      formattedPhone: '',
      localNumber: '',
      error: 'Please enter a valid 10-digit Indian mobile number.',
    };
  }

  // Indian mobile numbers start with 6, 7, 8, or 9
  const indianMobileRegex = /^[6-9]\d{9}$/;
  if (!indianMobileRegex.test(localNumber)) {
    return {
      isValid: false,
      formattedPhone: '',
      localNumber,
      error: 'Indian mobile numbers must start with 6, 7, 8, or 9.',
    };
  }

  return {
    isValid: true,
    formattedPhone: `+91${localNumber}`,
    localNumber,
  };
}

/**
 * Masks an E.164 or 10-digit phone number for secure UI display.
 * Example: "+919876543210" -> "+91 ••••• •3210"
 */
export function maskPhoneNumber(phone: string): string {
  const result = validateAndFormatIndianPhone(phone);
  if (!result.isValid) {
    return phone;
  }

  const local = result.localNumber;
  const lastFour = local.slice(-4);
  return `+91 ••••• •${lastFour}`;
}

/**
 * Converts a normalized phone number into a deterministic internal Supabase Auth email.
 * Format: "919876543210@auth.bever.app"
 * This email is strictly internal and NEVER shown to the customer.
 */
export function phoneToInternalAuthEmail(phone: string): string {
  const result = validateAndFormatIndianPhone(phone);
  const digits = result.isValid
    ? result.formattedPhone.replace(/\D/g, '')
    : phone.replace(/\D/g, '');
  return `customer_${digits}@bever.app`;
}
