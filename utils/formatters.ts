// Utility helpers for MarSU Lost & Found (E-Sauli)
// Date/time formatting in Asia/Manila, amount normalization, and privacy safe truncation.

export function formatDateManila(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleDateString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export function formatDateTimeManila(dateStr: string | null | undefined): string {
  if (!dateStr) return 'N/A';
  try {
    const d = new Date(dateStr);
    return d.toLocaleString('en-PH', {
      timeZone: 'Asia/Manila',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  } catch {
    return dateStr;
  }
}

export function normalizeCashAmount(input: string): string {
  if (!input) return '';
  let cleaned = input.trim().toUpperCase();
  cleaned = cleaned.replace(/^(PHP|₱|P)\s*/i, '');
  cleaned = cleaned.replace(/,/g, '').trim();

  const num = parseFloat(cleaned);
  if (isNaN(num)) return cleaned;
  return num % 1 === 0 ? num.toFixed(0) : num.toFixed(2);
}

export function truncateText(text: string, maxLength: number = 60): string {
  if (!text) return '';
  if (text.length <= maxLength) return text;
  return text.substring(0, maxLength) + '...';
}
