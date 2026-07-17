export async function hashPasscode(value){
  const bytes=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(String(value)));
  return [...new Uint8Array(bytes)].map(byte=>byte.toString(16).padStart(2,'0')).join('');
}

export async function verifyPasscode(value,expectedHash){
  if(!expectedHash)return false;
  return (await hashPasscode(value))===expectedHash;
}
