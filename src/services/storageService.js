// services/storageService.js
import { supabase } from './supabaseClient';

const BUCKET = 'study-materials';

export async function uploadMaterial({ subjectId, title, file, onProgress }) {
  const path = `${subjectId}/${Date.now()}_${file.name}`;

  // supabase-js v2 doesn't expose upload progress natively; use XHR via a
  // signed upload URL for real progress bars.
  const { data: signed, error: signErr } = await supabase.storage
    .from(BUCKET)
    .createSignedUploadUrl(path);
  if (signErr) throw signErr;

  await new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest();
    xhr.open('PUT', signed.signedUrl);
    xhr.upload.onprogress = (e) => {
      if (onProgress && e.lengthComputable) onProgress(Math.round((e.loaded / e.total) * 100));
    };
    xhr.onload = () => (xhr.status < 300 ? resolve() : reject(new Error('Upload failed')));
    xhr.onerror = () => reject(new Error('Upload failed'));
    xhr.send(file);
  });

  const { data: urlData } = await supabase.storage.from(BUCKET).createSignedUrl(path, 60 * 60 * 24 * 7);

  const { data, error } = await supabase
    .from('study_materials')
    .insert({
      subject_id: subjectId,
      title,
      file_name: file.name,
      file_path: path,
      file_url: urlData?.signedUrl,
      file_size: file.size,
      mime_type: file.type,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

export async function deleteMaterial(material) {
  const { error: storageErr } = await supabase.storage.from(BUCKET).remove([material.file_path]);
  if (storageErr) throw storageErr;

  const { error } = await supabase.from('study_materials').delete().eq('id', material.id);
  if (error) throw error;
}

export async function refreshSignedUrl(filePath) {
  const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(filePath, 60 * 60 * 24 * 7);
  if (error) throw error;
  return data.signedUrl;
}
