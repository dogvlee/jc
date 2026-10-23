// Shop owners pick printers by the name printed on the device, so the picker
// never shows raw RSSI numbers or device IDs. 深云达 (SYD) printers, the
// receipt app's own brand, are recognised by name and listed first; every
// other named device can be connected all the same.
const SYD_NAME = /^SYD(?=[-_\s\d]|$)/i;

function deviceNames(device) {
  if (!device) return [];
  return [device.displayName, device.name, device.localName]
    .map((value) => String(value || '').trim())
    .filter(Boolean);
}

/** { supported, label } from the advertised name. */
function classifyPrinter(device) {
  return deviceNames(device).some((name) => SYD_NAME.test(name))
    ? { supported: true, label: '热敏打印机' }
    : { supported: false, label: '' };
}

function signalStrength(device) {
  const rssi = Number(device && device.RSSI);
  return Number.isFinite(rssi) && rssi < 0 ? rssi : -200;
}

/** Known printers first, then every other named device; each group by signal. */
function sortDevices(devices) {
  return (Array.isArray(devices) ? devices : [])
    .filter((device) => device && device.deviceId && deviceNames(device).length)
    .map((device, index) => ({
      device,
      index,
      supported: classifyPrinter(device).supported ? 1 : 0,
      signal: signalStrength(device)
    }))
    .sort((left, right) => (right.supported - left.supported)
      || (right.signal - left.signal)
      || (left.index - right.index))
    .map((entry) => entry.device);
}

/** '信号强' | '信号中' | '信号弱', or '' when the phone reported no usable RSSI. */
function signalLabel(rssi) {
  const value = Number(rssi);
  // iOS reports 127 (and some Android builds 0) when the strength is unknown.
  if (rssi == null || rssi === '' || !Number.isFinite(value) || value >= 0) return '';
  if (value >= -60) return '信号强';
  if (value >= -75) return '信号中';
  return '信号弱';
}

function printerDisplayName(device) {
  return deviceNames(device)[0] || '未命名设备';
}

module.exports = {
  classifyPrinter,
  printerDisplayName,
  signalLabel,
  sortDevices
};
