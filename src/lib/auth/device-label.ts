export function getDeviceLabel(userAgent: string | null | undefined): string {
  const value = userAgent ?? "";
  const browser = /Edg\//.test(value)
    ? "Edge"
    : /OPR\//.test(value)
      ? "Opera"
      : /Firefox\//.test(value)
        ? "Firefox"
        : /Chrome\//.test(value)
          ? "Chrome"
          : /Safari\//.test(value)
            ? "Safari"
            : "Browser";

  const device = /iPad|Tablet/i.test(value)
    ? "Tablet"
    : /iPhone/i.test(value)
      ? "iPhone"
      : /Android/i.test(value)
        ? (/Mobile/i.test(value) ? "Android" : "Android tablet")
        : /Windows/i.test(value)
          ? "Windows PC"
          : /Macintosh|Mac OS X/i.test(value)
            ? "Mac"
            : /Linux/i.test(value)
              ? "Linux PC"
              : "Perangkat";

  return `${device} · ${browser}`.slice(0, 100);
}
