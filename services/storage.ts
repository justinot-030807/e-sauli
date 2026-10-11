import * as ImageManipulator from 'expo-image-manipulator';
import { supabase } from '@/lib/supabase';
import { SENSITIVE_CATEGORIES, type ItemCategory } from '@/constants/categories';

const PRIVATE_BUCKET = 'item-photos';
const MAX_DIMENSION = 1280;
const MAX_FILE_SIZE_BYTES = 5 * 1024 * 1024; // 5MB limit before compression
const TARGET_SIZE_BYTES = 200 * 1024; // ~200KB target after compression
const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp'];
const SIGNED_URL_EXPIRES_IN_SECONDS = 3600; // 1 hour short-lived signed URL

export interface ProcessedImage {
  uri: string;
  width: number;
  height: number;
  base64?: string;
}

/**
 * Checks if a category is allowed to have a photo uploaded.
 * Photo upload is disabled for: Cash, Wallet, ID/Cards.
 */
export function isPhotoUploadAllowed(category: ItemCategory): boolean {
  return !SENSITIVE_CATEGORIES.includes(category);
}

/**
 * Validates and processes an image prior to upload.
 * - Rejects sensitive categories (Cash, Wallet, ID/Cards)
 * - Checks file size
 * - Resizes to maximum 1280px on longest side
 * - Compresses to approximately 200KB target
 * - Removes EXIF/GPS metadata via re-encoding
 */
export async function processItemImage(
  uri: string,
  category: ItemCategory,
  fileSizeBytes?: number
): Promise<ProcessedImage> {
  if (!isPhotoUploadAllowed(category)) {
    throw new Error(
      `Photo upload is strictly disabled for "${category}". Please use the category icon instead.`
    );
  }

  if (fileSizeBytes && fileSizeBytes > MAX_FILE_SIZE_BYTES) {
    throw new Error('Image exceeds maximum allowed size of 5MB.');
  }

  // First pass: resize to max 1280px maintaining aspect ratio
  const manipulationResult = await ImageManipulator.manipulateAsync(
    uri,
    [
      {
        resize: {
          width: MAX_DIMENSION,
        },
      },
    ],
    {
      compress: 0.7, // Target ~200KB
      format: ImageManipulator.SaveFormat.JPEG,
    }
  );

  return manipulationResult;
}

/**
 * Uploads a processed item photo to the private Supabase storage bucket.
 * Uses short-lived signed URLs for reading. Never exposes public URLs.
 */
export async function uploadItemPhoto(
  userId: string,
  imageUri: string,
  category: ItemCategory
): Promise<string> {
  if (!isPhotoUploadAllowed(category)) {
    throw new Error(`Photo upload is prohibited for category: ${category}`);
  }

  const processed = await processItemImage(imageUri, category);

  // Read image as ArrayBuffer or blob
  const response = await fetch(processed.uri);
  const blob = await response.blob();

  const fileExt = 'jpg';
  const fileName = `${userId}/${Date.now()}_${Math.random().toString(36).substring(2, 9)}.${fileExt}`;

  const { error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .upload(fileName, blob, {
      contentType: 'image/jpeg',
      upsert: false,
    });

  if (error) {
    throw new Error(`Failed to upload photo: ${error.message}`);
  }

  return fileName;
}

/**
 * Generates a short-lived signed URL for a private item photo.
 * Defaults to 1 hour expiration.
 */
export async function getSignedPhotoUrl(
  photoPath: string,
  expiresInSeconds: number = SIGNED_URL_EXPIRES_IN_SECONDS
): Promise<string | null> {
  if (!photoPath) return null;

  const { data, error } = await supabase.storage
    .from(PRIVATE_BUCKET)
    .createSignedUrl(photoPath, expiresInSeconds);

  if (error) {
    console.error('Error creating signed URL:', error);
    return null;
  }

  return data.signedUrl;
}
