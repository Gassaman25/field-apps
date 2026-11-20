export async function storageStatus() {
  let persisted = false;
  if (navigator.storage?.persist) {
    try {
      persisted = await navigator.storage.persisted();
      if (!persisted) persisted = await navigator.storage.persist();
    } catch {
      persisted = false;
    }
  }
  let usage = 0;
  let quota = 0;
  if (navigator.storage?.estimate) {
    try {
      const estimate = await navigator.storage.estimate();
      usage = estimate.usage || 0;
      quota = estimate.quota || 0;
    } catch {
      usage = 0;
      quota = 0;
    }
  }
  return { persisted, usage, quota };
}

export function formatBytes(bytes) {
  if (!bytes) return "0 MB";
  const units = ["B", "KB", "MB", "GB"];
  let value = bytes;
  let unit = 0;
  while (value >= 1024 && unit < units.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value >= 10 || unit === 0 ? value.toFixed(0) : value.toFixed(1)} ${units[unit]}`;
}
