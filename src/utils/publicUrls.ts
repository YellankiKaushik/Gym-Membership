// Build-time branding is public. Reject executable schemes and credential URLs.
export function publicImageUrl(value?: string): string {
  const candidate = value?.trim() || '';
  if ([...candidate].some(character => character.charCodeAt(0) < 32)) return '';
  if (/^\/(?![\\/])/.test(candidate)) return candidate;
  return publicHttpsUrl(candidate);
}

export function publicHttpsUrl(value?: string): string {
  try {
    const url = new URL(value || '');
    return url.protocol === 'https:' && !url.username && !url.password ? url.href : '';
  } catch { return ''; }
}
