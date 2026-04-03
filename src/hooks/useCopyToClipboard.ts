import { useState, useCallback } from 'react';

export function useCopyToClipboard(resetDelay: number = 2000) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), resetDelay);
      return true;
    } catch (err) {
      console.error('Failed to copy:', err);
      return false;
    }
  }, [resetDelay]);

  return { copied, copy };
}
