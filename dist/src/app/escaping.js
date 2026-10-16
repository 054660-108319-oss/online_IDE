/** Escape untrusted project metadata before inserting it into rendered markup. */
export const escapeHtml=value=>String(value).replace(/[&<>"']/g,char=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[char]));

// Attribute values use the same escaping, including both quote characters.
export const escapeAttribute=escapeHtml;
