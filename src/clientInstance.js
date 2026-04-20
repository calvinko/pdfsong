const CLIENT_INSTANCE_STORAGE_KEY = 'songbook-pwa-client-instance-v1';

function hashText(value) {
  let hash = 0;

  for (let index = 0; index < value.length; index += 1) {
    hash = Math.imul(31, hash) + value.charCodeAt(index);
    hash |= 0;
  }

  return Math.abs(hash).toString(36);
}

function makeRandomId() {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  }

  return Math.random().toString(36).slice(2, 14);
}

function readStoredInstance() {
  try {
    const raw = localStorage.getItem(CLIENT_INSTANCE_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : null;
    return parsed?.instanceId ? parsed : null;
  } catch {
    return null;
  }
}

function writeStoredInstance(instance) {
  localStorage.setItem(CLIENT_INSTANCE_STORAGE_KEY, JSON.stringify(instance));
}

export function detectDeviceInfo() {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') {
    return null;
  }

  const ua = navigator.userAgent || '';
  const platform = navigator.userAgentData?.platform || navigator.platform || 'Unknown platform';
  const lowerUa = ua.toLowerCase();
  const maxTouchPoints = Number(navigator.maxTouchPoints || 0);
  const hasTouch = maxTouchPoints > 0 || 'ontouchstart' in window;
  const screenWidth = Number(window.screen?.width || 0);
  const screenHeight = Number(window.screen?.height || 0);

  let operatingSystem = 'Unknown OS';
  if (lowerUa.includes('android')) operatingSystem = 'Android';
  else if (lowerUa.includes('iphone') || lowerUa.includes('ipad') || lowerUa.includes('ipod')) operatingSystem = 'iOS';
  else if (lowerUa.includes('mac os x') || platform.toLowerCase().includes('mac')) operatingSystem = 'macOS';
  else if (lowerUa.includes('win')) operatingSystem = 'Windows';
  else if (lowerUa.includes('linux') || platform.toLowerCase().includes('linux')) operatingSystem = 'Linux';
  else if (lowerUa.includes('cros')) operatingSystem = 'ChromeOS';

  let browser = 'Unknown browser';
  if (lowerUa.includes('edg/')) browser = 'Edge';
  else if (lowerUa.includes('opr/') || lowerUa.includes('opera')) browser = 'Opera';
  else if (lowerUa.includes('chrome/') && !lowerUa.includes('edg/')) browser = 'Chrome';
  else if (lowerUa.includes('safari/') && !lowerUa.includes('chrome/')) browser = 'Safari';
  else if (lowerUa.includes('firefox/')) browser = 'Firefox';

  let deviceType = 'Desktop';
  if (navigator.userAgentData?.mobile || lowerUa.includes('mobile') || lowerUa.includes('iphone')) {
    deviceType = 'Phone';
  } else if (lowerUa.includes('ipad') || lowerUa.includes('tablet') || (hasTouch && screenWidth > 0 && screenWidth <= 1024)) {
    deviceType = 'Tablet';
  } else if (hasTouch && operatingSystem === 'Windows') {
    deviceType = 'Touch laptop/tablet';
  }

  const brands = Array.isArray(navigator.userAgentData?.brands)
    ? navigator.userAgentData.brands.map((entry) => entry.brand).filter(Boolean)
    : [];
  const machine = brands[0] || platform || operatingSystem;

  return {
    machine,
    deviceType,
    operatingSystem,
    browser,
    touch: hasTouch ? `Yes (${maxTouchPoints || 1} touch point${maxTouchPoints === 1 ? '' : 's'})` : 'No',
    screen: screenWidth && screenHeight ? `${screenWidth} x ${screenHeight}` : 'Unknown'
  };
}

export function getClientInstance() {
  if (typeof window === 'undefined' || typeof localStorage === 'undefined') {
    return null;
  }

  const deviceInfo = detectDeviceInfo();
  const stored = readStoredInstance();

  if (stored) {
    return {
      ...stored,
      deviceInfo
    };
  }

  const deviceKey = [
    deviceInfo?.deviceType,
    deviceInfo?.operatingSystem,
    deviceInfo?.browser,
    deviceInfo?.machine,
    deviceInfo?.screen,
    navigator.language || ''
  ].filter(Boolean).join('|');
  const instance = {
    instanceId: `inst-${hashText(deviceKey || 'unknown-device')}-${makeRandomId()}`,
    deviceType: deviceInfo?.deviceType || 'Unknown',
    operatingSystem: deviceInfo?.operatingSystem || 'Unknown OS',
    browser: deviceInfo?.browser || 'Unknown browser',
    machine: deviceInfo?.machine || 'Unknown machine',
    screen: deviceInfo?.screen || 'Unknown',
    createdAt: new Date().toISOString()
  };

  writeStoredInstance(instance);

  return {
    ...instance,
    deviceInfo
  };
}
