const RECIPIENT_PARAM = 'recipient';
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function normalizeRecipient(value) {
  const email = String(value ?? '').trim();
  return EMAIL_PATTERN.test(email) ? email : null;
}

export function readRecipientFromUrl(inputUrl) {
  const url = new URL(inputUrl);
  if (!url.searchParams.has(RECIPIENT_PARAM)) {
    return { present: false, email: null };
  }
  return {
    present: true,
    email: normalizeRecipient(url.searchParams.get(RECIPIENT_PARAM)),
  };
}

export function applyRecipientFromUrl(settings, inputUrl) {
  const recipient = readRecipientFromUrl(inputUrl);
  if (!recipient.present) return settings;
  return {
    ...settings,
    company: {
      ...settings.company,
      email: recipient.email ?? '',
    },
  };
}

export function buildCustomerUrl(email, inputUrl) {
  const recipient = normalizeRecipient(email);
  if (!recipient) {
    throw new Error('有効な送信先メールアドレスを入力してください。');
  }
  const url = new URL(inputUrl);
  url.search = '';
  url.hash = '';
  url.searchParams.set(RECIPIENT_PARAM, recipient);
  return url.toString();
}
