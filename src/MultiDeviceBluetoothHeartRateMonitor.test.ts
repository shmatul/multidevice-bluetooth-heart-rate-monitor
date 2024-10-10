import { MultiDeviceBluetoothHeartRateMonitor } from "./MultiDeviceBluetoothHeartRateMonitor";
import noble from "@abandonware/noble";

jest.mock("@abandonware/noble");

// Define a mock type for noble
type MockNoble = {
  on: jest.Mock;
  startScanningAsync: jest.Mock;
  emit: (event: string, ...args: any[]) => boolean;
};

describe("MultiDeviceBluetoothHeartRateMonitor", () => {
  let monitor: MultiDeviceBluetoothHeartRateMonitor;
  let mockNoble: MockNoble;

  beforeEach(() => {
    jest.clearAllMocks();
    mockNoble = noble as unknown as MockNoble;
    mockNoble.on = jest.fn();
    mockNoble.startScanningAsync = jest.fn().mockResolvedValue(undefined);
    monitor = new MultiDeviceBluetoothHeartRateMonitor();
  });

  test("startScanning should start scanning when adapter is ready", async () => {
    // Increase the timeout for this test
    jest.setTimeout(10000);

    // Add a spy on console.log for debugging
    const consoleLogSpy = jest.spyOn(console, "log");

    // Simulate the adapter being ready
    mockNoble.emit("stateChange", "poweredOn");

    // Call startScanning
    const scanningPromise = monitor.startScanning();

    // Wait a short time to allow internal promises to resolve
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Manually resolve the adapterReadyPromise
    (monitor as any).adapterReadyResolver();

    // Wait for scanning to complete
    await scanningPromise;

    // Log debug information
    console.log("Console log calls:", consoleLogSpy.mock.calls);
    console.log(
      "Noble startScanningAsync calls:",
      mockNoble.startScanningAsync.mock.calls
    );
    console.log("Monitor isScanning:", (monitor as any).isScanning);

    // Check if noble.startScanningAsync was called with the correct parameters
    expect(mockNoble.startScanningAsync).toHaveBeenCalledWith(["180D"], true);

    // Check if isScanning is set to true
    expect((monitor as any).isScanning).toBe(true);

    // Restore console.log
    consoleLogSpy.mockRestore();
  });

  test("startScanning should not continue if adapter is not powered on", async () => {
    // Increase the timeout for this test
    jest.setTimeout(10000);

    // Add a spy on console.log for debugging
    const consoleLogSpy = jest.spyOn(console, "log");

    // Start scanning without emitting the 'poweredOn' state
    const scanningPromise = monitor.startScanning();

    // Wait for a short time to allow any immediate operations to complete
    await new Promise((resolve) => setTimeout(resolve, 100));

    // Log debug information
    console.log("Console log calls:", consoleLogSpy.mock.calls);
    console.log(
      "Noble startScanningAsync calls:",
      mockNoble.startScanningAsync.mock.calls
    );
    console.log("Monitor isScanning:", (monitor as any).isScanning);

    // Check that noble.startScanningAsync was not called
    expect(mockNoble.startScanningAsync).not.toHaveBeenCalled();

    // Check that isScanning is still false
    expect((monitor as any).isScanning).toBe(false);

    // Ensure the scanning promise doesn't resolve within a reasonable timeframe
    await expect(
      Promise.race([
        scanningPromise,
        new Promise((resolve) => setTimeout(() => resolve("timeout"), 1000)),
      ])
    ).resolves.toBe("timeout");

    // Restore console.log
    consoleLogSpy.mockRestore();
  });
});
