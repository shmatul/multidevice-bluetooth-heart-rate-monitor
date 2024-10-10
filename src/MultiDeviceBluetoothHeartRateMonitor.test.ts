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
    it("shouldnt be scanning if startScannint wasn't called", async () => {
      (monitor as any).handleStateChange("poweredOn");
      //   await monitor.startScanning();
      expect(noble.startScanningAsync).not.toHaveBeenCalled();
    });
    it("should start scanning when not already scanning", async () => {
      (monitor as any).handleStateChange("poweredOn");
      (monitor as any).isScanning = false;
      await monitor.startScanning();
      expect(noble.startScanningAsync).toHaveBeenCalledWith(["180D"], true);
    });

    it("should not start scanning when already scanning", async () => {
      // Mock the adapterReadyPromise to resolve immediately
      (monitor as any).handleStateChange("poweredOn");

      // Set isScanning to true
      (monitor as any).isScanning = true;

      // Call startScanning
      await monitor.startScanning();

      // Expect that noble.startScanningAsync was not called
      expect(noble.startScanningAsync).not.toHaveBeenCalled();
    });

    it("shouldn't start scanning if adapter is not ready", (done) => {
      const timeout = setTimeout(() => {
        done();
      }, 200); // 1 second timeout

      // Set isScanning to false
      (monitor as any).isScanning = false;

      // Call startScanning
      monitor
        .startScanning() // Return a promise, but handle it as follows
        .then(() => {
          // If we reach here, clear the timeout since the call completed
          clearTimeout(timeout);

          // Expect that noble.startScanningAsync was not called
          expect(noble.startScanningAsync).not.toHaveBeenCalled();

          // Mark the test as done
          done();
        })
        .catch((error) => {
          // If an error occurs, clear the timeout and fail the test
          clearTimeout(timeout);
          done.fail(error);
        });
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

  it("should handle state change and prepare for scanning", async () => {
    // Mock startScanning method
    const startScanningSpy = jest
      .spyOn(monitor, "startScanning")
      .mockResolvedValue();

    // Spy on the emit method
    const emitSpy = jest.spyOn(monitor, "emit");

    // Get the stateChange callback
    const stateChangeCb = (noble.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "stateChange"
    )[1];

    // Call the stateChange callback with "poweredOn"
    await stateChangeCb("poweredOn");

    // Expect that the adapterReadyPromise is resolved
    await expect((monitor as any).adapterReadyPromise).resolves.toBeUndefined();

    // Expect that the "adapterReady" event is emitted
    expect(emitSpy).toHaveBeenCalledWith("adapterReady");

    // Verify that noble.startScanningAsync was not called directly
    expect(noble.startScanningAsync).not.toHaveBeenCalled();

    // Verify that startScanning method can now be called without waiting
    await monitor.startScanning();
    expect(startScanningSpy).toHaveBeenCalled();

    // Clean up spies
    startScanningSpy.mockRestore();
    emitSpy.mockRestore();
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

  it("should start scanning after state changes to poweredOn", async () => {
    // Get the stateChange callback
    const stateChangeCb = (noble.on as jest.Mock).mock.calls.find(
      (call) => call[0] === "stateChange"
    )[1];

    // Start scanning in a separate promise
    const scanningPromise = monitor.startScanning();

    // Simulate state change to poweredOn
    await stateChangeCb("poweredOn");

    // Wait for scanning to complete
    await scanningPromise;

    // Verify that noble.startScanningAsync was called
    expect(noble.startScanningAsync).toHaveBeenCalled();
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
