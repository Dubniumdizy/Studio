import { z } from 'zod';

// Email validation schema
export const emailSchema = z
  .string()
  .email('Please enter a valid email address')
  .min(1, 'Email is required');

// Password validation schema
export const passwordSchema = z
  .string()
  .min(8, 'Password must be at least 8 characters')
  .regex(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)/, 'Password must contain at least one uppercase letter, one lowercase letter, and one number');

// Login form schema
export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required'),
});

// Signup form schema
export const signupSchema = z.object({
  email: emailSchema,
  password: passwordSchema,
  confirmPassword: z.string(),
  displayName: z.string().min(1, 'Display name is required').max(50, 'Display name must be less than 50 characters'),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

// Flashcard validation schemas
export const flashcardSchema = z.object({
  front: z.string().min(1, 'Front content is required').max(1000, 'Front content must be less than 1000 characters'),
  back: z.string().min(1, 'Back content is required').max(1000, 'Back content must be less than 1000 characters'),
  frontImage: z.string().url().optional().or(z.literal('')),
  backImage: z.string().url().optional().or(z.literal('')),
});

export const deckSchema = z.object({
  name: z.string().min(1, 'Deck name is required').max(100, 'Deck name must be less than 100 characters'),
  description: z.string().max(500, 'Description must be less than 500 characters').optional(),
  subject: z.string().min(1, 'Subject is required').max(50, 'Subject must be less than 50 characters'),
});

export const folderSchema = z.object({
  name: z.string().min(1, 'Folder name is required').max(100, 'Folder name must be less than 100 characters'),
});

// Utility functions
export function validateEmail(email: string): { isValid: boolean; error?: string } {
  try {
    emailSchema.parse(email);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0].message };
    }
    return { isValid: false, error: 'Invalid email format' };
  }
}

export function validatePassword(password: string): { isValid: boolean; error?: string; strength: 'weak' | 'medium' | 'strong' } {
  try {
    passwordSchema.parse(password);
    
    // Calculate password strength
    let score = 0;
    if (password.length >= 8) score++;
    if (/[a-z]/.test(password)) score++;
    if (/[A-Z]/.test(password)) score++;
    if (/\d/.test(password)) score++;
    if (/[^A-Za-z0-9]/.test(password)) score++;
    
    const strength = score < 3 ? 'weak' : score < 5 ? 'medium' : 'strong';
    
    return { isValid: true, strength };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { isValid: false, error: error.errors[0].message, strength: 'weak' };
    }
    return { isValid: false, error: 'Invalid password format', strength: 'weak' };
  }
}

export function validateForm<T>(schema: z.ZodSchema<T>, data: unknown): { isValid: boolean; errors?: Record<string, string> } {
  try {
    schema.parse(data);
    return { isValid: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      const errors: Record<string, string> = {};
      error.errors.forEach((err) => {
        const path = err.path.join('.');
        errors[path] = err.message;
      });
      return { isValid: false, errors };
    }
    return { isValid: false, errors: { general: 'Validation failed' } };
  }
}

// Network error handling
export function isNetworkError(error: unknown): boolean {
  if (error instanceof Error) {
    return (
      error.message.includes('Network Error') ||
      error.message.includes('Failed to fetch') ||
      error.message.includes('ERR_NETWORK') ||
      error.message.includes('ERR_INTERNET_DISCONNECTED')
    );
  }
  return false;
}

export function getErrorMessage(error: unknown): string {
  if (error instanceof Error) {
    if (isNetworkError(error)) {
      return 'Network error. Please check your internet connection and try again.';
    }
    return error.message;
  }
  if (typeof error === 'string') {
    return error;
  }
  return 'An unexpected error occurred. Please try again.';
} 