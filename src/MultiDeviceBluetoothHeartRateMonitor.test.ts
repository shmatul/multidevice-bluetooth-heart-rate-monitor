import { MultiDeviceBluetoothHeartRateMonitor } from "./MultiDeviceBluetoothHeartRateMonitor";
import {
  BluetoothHeartRateDevice,
  DeviceData,
} from "./BluetoothHeartRateDevice";
import noble from "@abandonware/noble";

jest.mock("@abandonware/noble", () => ({
  on: jest.fn(),
  startScanningAsync: jest.fn(),
  stopScanningAsync: jest.fn(),
}));

jest.mock("./BluetoothHeartRateDevice");

describe("MultiDeviceBluetoothHeartRateMonitor", () => {
  let monitor: MultiDeviceBluetoothHeartRateMonitor;

  beforeEach(() => {
    jest.clearAllMocks();
    monitor = new MultiDeviceBluetoothHeartRateMonitor();
  });

  describe("startScanning", () => {
    it("should start scanning when not already scanning", async () => {
      (monitor as any).isScanning = false;
      await monitor.startScanning();
      expect(noble.startScanningAsync).toHaveBeenCalledWith(["180D"], true);
    });

    it("should not start scanning when already scanning", async () => {
      (monitor as any).isScanning = true;
      await monitor.startScanning();
      expect(noble.startScanningAsync).not.toHaveBeenCalled();
    });
  });

  describe("stopScanning", () => {
    it("should stop scanning when scanning is in progress", async () => {
      (monitor as any).isScanning = true;
      await monitor.stopScanning();
      expect(noble.stopScanningAsync).toHaveBeenCalled();
    });

    it("should not stop scanning when scanning is not in progress", async () => {
      (monitor as any).isScanning = false;
      await monitor.stopScanning();
      expect(noble.stopScanningAsync).not.toHaveBeenCalled();
    });
  });

  it("should handle state change", async () => {
    const stateChangeCb = (noble.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "stateChange"
    )[1];
    await stateChangeCb("poweredOn");
    expect(noble.startScanningAsync).toHaveBeenCalled();
  });

  it("should handle device discovery", async () => {
    const mockPeripheral = {
      id: "test-id",
      connectable: true,
      advertisement: { localName: "Test Device" },
    };
    const discoveryCb = (noble.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "discover"
    )[1];
    await discoveryCb(mockPeripheral);
    expect(BluetoothHeartRateDevice).toHaveBeenCalledWith(mockPeripheral);
  });

  it("should get connected devices", () => {
    const mockDevice = new BluetoothHeartRateDevice({} as any);
    (monitor as any).devices.set("test-id", mockDevice);
    const connectedDevices = monitor.getConnectedDevices();
    expect(connectedDevices).toHaveLength(1);
    expect(connectedDevices[0]).toBe(mockDevice);
  });

  it("should handle device data", () => {
    const mockData = { heartRate: 75, deviceId: "test-id" };
    const spy = jest.spyOn(monitor, "emit");
    (monitor as any).handleDeviceData(mockData);
    expect(spy).toHaveBeenCalledWith(
      "data",
      expect.objectContaining({
        heartRate: 75,
        deviceId: "test-id",
        timestamp: expect.any(String),
      })
    );
  });

  it("should handle device disconnect", async () => {
    const mockDevice = new BluetoothHeartRateDevice({} as any);
    (monitor as any).devices.set("test-id", mockDevice);
    const spy = jest.spyOn(monitor, "emit");
    await (monitor as any).handleDeviceDisconnect("test-id");
    expect(spy).toHaveBeenCalledWith("deviceDisconnected", mockDevice);
    expect((monitor as any).devices.size).toBe(0);
  });
});
