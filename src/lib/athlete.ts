/** The athlete's face and flag, as small pieces of HTML (the same on the map and in the panel) */
import { escapeHtml } from './map/html';

/** Flags drawn by hand (crisp at any size, the same on every system). Others use the emoji flag. */
const FLAGS: Record<string, string> = {
    CZ: '<rect width="30" height="10" fill="#fff"/><rect y="10" width="30" height="10" fill="#d7141a"/><path d="M0 0 15 10 0 20z" fill="#11457e"/>',
    FR: '<rect width="10" height="20" fill="#002654"/><rect x="10" width="10" height="20" fill="#fff"/><rect x="20" width="10" height="20" fill="#ce1126"/>',
    SK: '<rect width="30" height="7" fill="#fff"/><rect y="6.6" width="30" height="6.8" fill="#0b4ea2"/><rect y="13.3" width="30" height="6.7" fill="#ee1c25"/>',
};

/** A small flag for a two-letter country code ("CZ"); empty when there's none */
export function flagHtml(code: string, height = 12): string {
    const c = (code || '').toUpperCase();
    if (!/^[A-Z]{2}$/.test(c)) {return '';}
    const svg = FLAGS[c];
    if (svg) {return `<svg class="rt-flag" width="${height * 1.5}" height="${height}" viewBox="0 0 30 20" role="img" aria-label="${c}">${svg}</svg>`;}
    const emoji = String.fromCodePoint(...[...c].map(ch => 0x1f1e6 + ch.charCodeAt(0) - 65));
    return `<span class="rt-flag-e" role="img" aria-label="${c}">${emoji}</span>`;
}

/** "Milan Koláček" → "MK" */
export const initials = (name: string): string =>
    name.split(/\s+/).filter(Boolean).slice(0, 2).map(p => p[0]?.toUpperCase() || '').join('');

/**
 * A round photo, with the initials underneath: if the photo is missing or doesn't load, the initials show.
 * `url` must already be checked (https, a file next to race.json, or a data:image picture).
 */
export function avatarHtml(name: string, url: string, cls = ''): string {
    const img = url ? `<img src="${escapeHtml(url)}" alt="" loading="lazy" decoding="async" referrerpolicy="no-referrer">` : '';
    return `<span class="rt-ava${cls ? ' ' + cls : ''}"><span class="rt-ini">${escapeHtml(initials(name))}</span>${img}</span>`;
}
