import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export type PhotoSource = 'camera' | 'library';

/** Opens the camera or gallery. Returns a local image URI, or null if the user cancelled or denied access. */
export async function choosePhoto(source: PhotoSource): Promise<{ uri: string | null; denied: boolean }> {
  const perm = source === 'camera'
    ? await ImagePicker.requestCameraPermissionsAsync()
    : await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) return { uri: null, denied: true };
  const opts: ImagePicker.ImagePickerOptions = { mediaTypes: ['images'], allowsEditing: true, aspect: [1, 1], quality: 0.6 };
  const res = source === 'camera' ? await ImagePicker.launchCameraAsync(opts) : await ImagePicker.launchImageLibraryAsync(opts);
  if (res.canceled || !res.assets[0]) return { uri: null, denied: false };
  return { uri: res.assets[0].uri, denied: false };
}

/** Uploads a local image to the public product-images bucket and returns its public URL. */
export async function uploadProductPhoto(storeId: string, uri: string): Promise<string> {
  const body = await (await fetch(uri)).arrayBuffer();
  const path = `${storeId}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
  const { error } = await supabase.storage.from('product-images').upload(path, body, { contentType: 'image/jpeg', upsert: false });
  if (error) throw error;
  return supabase.storage.from('product-images').getPublicUrl(path).data.publicUrl;
}
