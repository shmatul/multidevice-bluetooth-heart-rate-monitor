import noble, { Peripheral, Characteristic } from "@abandonware/noble";
import { EventEmitter } from "events";
import {
  BluetoothHeartRateDevice,
  DeviceData,
} from "./BluetoothHeartRateDevice";

class MultiDeviceBluetoothHeartRateMonitor extends EventEmitter {
  public devices: Map<string, BluetoothHeartRateDevice> = new Map();
  public discoveredDevices: Map<string, BluetoothHeartRateDevice> = new Map();
  private static readonly HRM_SERVICE_UUID = "180D";
  private isScanning: boolean = false;
  private pendingScanRequest: boolean = false;
  private scanInterval: NodeJS.Timeout | null = null;
  private adapterReadyPromise: Promise<void> | null = null;
  private adapterReadyResolver: (() => void) | null = null;
  private initializedScanningRequest: boolean = false;
  private DISCOVERED_DEVICE_TIMEOUT = 5000;
  private cleanupOldDiscoveredDevicesInterval: NodeJS.Timeout | null = null;

  /**
   * Creates a new MultiDeviceBluetoothHeartRateMonitor instance.
   */
  constructor() {
    super();
    this.resetAdapterReadyPromise();
    this.setupNobleListeners();
    this.setupGracefulShutdown();
    this.setupPowerManagement();
    this.cleanupOldDevices();
  }

  public async startScanning(): Promise<void> {
    this.initializedScanningRequest = true;
    await this.startScanning_DO();
  }

  /**
   * Starts scanning for Bluetooth heart rate monitors.
   * @returns {Promise<void>}
   * @throws {Error} If there's an issue starting the scan.
   */
  private async startScanning_DO(): Promise<void> {
    if (
      this.isScanning ||
      !this.initializedScanningRequest ||
      this.pendingScanRequest
    ) {
      return;
    }
    this.pendingScanRequest = true;
    await this.adapterReadyPromise;

    console.log("Starting to scan for heart rate monitors...");
    try {
      await noble.startScanningAsync(
        [MultiDeviceBluetoothHeartRateMonitor.HRM_SERVICE_UUID],
        true
      );
      this.isScanning = true;
      this.pendingScanRequest = false;
    } catch (error: unknown) {
      if (error instanceof Error) {
        this.handleScanError(error);
      } else {
        console.error(
          "An unknown error occurred while starting the scan:",
          error
        );
        this.emit(
          "error",
          new Error("Unknown error occurred while starting the scan")
        );
      }
      this.pendingScanRequest = false;
    }
  }

  /**
   * Stops scanning for Bluetooth heart rate monitors.
   * @returns {Promise<void>}
   * @throws {Error} If there's an issue stopping the scan.
   */
  public async stopScanning(): Promise<void> {
    if (!this.isScanning) return;

    console.log("Stopping scan for heart rate monitors...");
    try {
      await noble.stopScanningAsync();
      this.isScanning = false;
      this.pendingScanRequest = false;
      if (this.scanInterval) {
        clearInterval(this.scanInterval);
        this.scanInterval = null;
      }
    } catch (error) {
      console.error("Error stopping scan:", error);
    }
  }

  /**
   * Returns an array of connected Bluetooth heart rate devices.
   * @returns {BluetoothHeartRateDevice[]} An array of connected devices.
   */
  public getConnectedDevices(): BluetoothHeartRateDevice[] {
    return Array.from(this.devices.values());
  }

  /**
   * Returns an array of discovered Bluetooth heart rate devices.
   * @returns {BluetoothHeartRateDevice[]} An array of discovered devices.
   */
  public getDiscoveredDevices(): BluetoothHeartRateDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Returns an array of active Bluetooth heart rate devices.
   * @returns {BluetoothHeartRateDevice[]} An array of active devices.
   */
  public getActiveDevices(): BluetoothHeartRateDevice[] {
    return Array.from(this.discoveredDevices.values());
  }

  /**
   * Handles errors that occur while scanning for devices.
   * @param {Error} error The error that occurred.
   */
  private handleScanError(error: Error): void {
    if (error.message.includes("ENODEV")) {
      console.error("No Bluetooth adapter found");
      this.emit("error", new Error("No Bluetooth adapter found"));
    } else if (error.message.includes("EPERM")) {
      console.error("Permission denied. May need elevated privileges");
      this.emit(
        "error",
        new Error("Permission denied. May need elevated privileges")
      );
    } else {
      console.error("Unknown error starting scan:", error);
      this.emit("error", error);
    }
  }

  /**
   * Sets up listeners for Noble events.
   * @private
   * @returns {void}
   * @event {string} adapterStateChange - When the adapter state changes.
   * @event {string} scanStart - When scanning starts.
   * @event {string} scanStop - When scanning stops.
   */
  private setupNobleListeners(): void {
    noble.on("stateChange", this.handleStateChange.bind(this));
    noble.on("discover", this.handleDiscovery.bind(this));
    noble.on("scanStart", () => this.emit("scanStart"));
    noble.on("scanStop", () => this.emit("scanStop"));
  }

  /**
   * Handles changes in the Bluetooth adapter state.
   * @param {string} state The new state of the adapter.
   * @returns {Promise<void>}
   * @event {string} adapterStateChange - When the adapter state changes.
   * @event {string} adapterReady - When the bluetooth adapter is ready.
   */
  private async handleStateChange(state: string): Promise<void> {
    console.log(`Bluetooth adapter state changed to: ${state}`);
    this.emit("adapterStateChange", state);

    try {
      if (state === "poweredOn") {
        if (this.adapterReadyResolver) {
          this.adapterReadyResolver();
        }
        this.emit("adapterReady");
        if (
          !this.pendingScanRequest &&
          !this.isScanning &&
          this.initializedScanningRequest
        ) {
          this.awakeWorkingMonitors();
          this.startScanning_DO();
        }
        this.resetAdapterReadyPromise();
      } else {
        this.resetAdapterReadyPromise();
        await this.stopScanning();
      }
    } catch (error) {
      console.error("Error handling state change:", error);
      this.emit("error", error);
    }
  }

  private awakeWorkingMonitors() {
    for (const device of this.devices.values()) {
      device.connect({ forceAwake: true });
    }
  }

  /**
   * Cleans up old discovered devices that are no longer discoverable.
   * @private
   * @returns {void}
   * @event {BluetoothHeartRateDevice} discoveredDeviceLost - The discovered device that is being removed.
   */
  private cleanupOldDevices() {
    this.cleanupOldDiscoveredDevicesInterval = setInterval(() => {
      const now = Date.now();
      for (const [uuid, device] of this.discoveredDevices.entries()) {
        if (
          !device.isConnecting() &&
          now - device.getLastSeen() > this.DISCOVERED_DEVICE_TIMEOUT
        ) {
          this.emit("discoveredDeviceLost", device);
          console.log(`Device ${uuid} no longer discoverable, removing...`);
          this.discoveredDevices.delete(uuid);
        }
      }
    }, this.DISCOVERED_DEVICE_TIMEOUT);
  }

  /**
   * Handles the discovery of a new bluetooth peripheral device.
   * @param {Peripheral} peripheral The noble bluetooth discovered peripheral device.
   */
  private async handleDiscovery(peripheral: Peripheral): Promise<void> {
    if (peripheral.connectable) {
      const workingDevice = this.devices.get(peripheral.id);
      const discoveredDevice = this.discoveredDevices.get(peripheral.id);
      if (discoveredDevice) {
        discoveredDevice.setLastSeen();
      } else if (workingDevice && !workingDevice.isConnected()) {
        // .. generally that should not happen since we are already connected, but just in case we missed the disconnect event let's reconnect:
        try {
          await workingDevice.connect();
        } catch (error) {
          console.error("Error reconnecting to peripheral:", error);
          this.emit("error", error);
        }
      } else {
        console.log(`Discovered device: ${peripheral.advertisement.localName}`);
        this.handleDiscoveryData(peripheral);
      }
    } else {
      console.log(
        `Discovered non-connectable device: ${peripheral.advertisement.localName}`
      );
    }
  }

  /**
   * Handles the discovery of a new bluetooth peripheral device.
   * @param {Peripheral} peripheral The noble bluetooth discovered peripheral device.
   * @event {BluetoothHeartRateDevice} deviceDiscovered - The data received from the discovered device.
   */
  private async handleDiscoveryData(peripheral: Peripheral): Promise<void> {
    try {
      const device = new BluetoothHeartRateDevice(peripheral);
      this.discoveredDevices.set(peripheral.id, device);
      this.emit("deviceDiscovered", device);
    } catch (error) {
      console.error("Error reconnecting to peripheral:", error);
      this.emit("error", error);
    }
  }

  /**
   * Handles the data received from a Bluetooth heart rate device.
   * @param {DeviceData} data The data received from the device.
   * @event {DeviceData} data - The data received from the device + timestamp.
   */
  private handleDeviceData(data: DeviceData): void {
    this.emit("data", { ...data, timestamp: new Date().toISOString() });
  }

  private async handleDeviceConnect(peripheralId: string) {
    const workingDevice = this.devices.get(peripheralId);
    const pendingDevice = this.discoveredDevices.get(peripheralId);
    if (workingDevice) {
      console.log(`Device ${peripheralId} is already marked connected.`);
    } else if (pendingDevice) {
      this.devices.set(pendingDevice.getDeviceInfo().deviceId, pendingDevice);
      this.discoveredDevices.delete(pendingDevice.getDeviceInfo().deviceId);
      pendingDevice.on("data", this.handleDeviceData.bind(this));
    }
    this.emit("deviceConnected", pendingDevice);
  }

  /**
   * Handles the disconnection of a Bluetooth heart rate device.
   * @param {string} peripheralId The ID of the device that was disconnected.
   * @event {BluetoothHeartRateDevice} deviceDisconnected - The device that was disconnected.
   */
  private async handleDeviceDisconnect(peripheralId: string) {
    const device = this.devices.get(peripheralId);
    if (device) {
      this.emit("deviceDisconnected", device);
      this.devices.delete(peripheralId);
    }
  }

  /**
   * Connects to a Bluetooth heart rate device.
   * @param {BluetoothHeartRateDevice} device The device to connect to.
   * @event {BluetoothHeartRateDevice} deviceConnected - The device that was disconnected.
   * @returns {void | Error}
   */
  public async connectDevice(
    device: BluetoothHeartRateDevice
  ): Promise<boolean> {
    return new Promise(async (resolve, reject) => {
      const discoveredDevice = this.discoveredDevices.get(
        device.getDeviceInfo().deviceId
      );
      if (discoveredDevice) {
        try {
          device.once("connected", this.handleDeviceConnect.bind(this));
          device.once("disconnect", this.handleDeviceDisconnect.bind(this));
          const deviceConnection = await device.connect();
          return resolve(deviceConnection);
        } catch (error) {
          reject(error);
        }
      } else {
        reject(new Error("Device not found in discovered devices"));
      }
    });
  }

  /**
   * Sets up power management event listeners for the system.
   * @private
   * @returns {void }
   */
  private setupPowerManagement(): void {
    if (process.platform === "darwin") {
      process.on("SIGTSTP", this.handleSleep.bind(this));
      process.on("SIGCONT", this.handleWake.bind(this));
    } else if (process.platform === "win32") {
      // For Windows, you might need to use a native module to detect sleep/wake events
    }
  }

  /**
   * Handles the system going to sleep.
   */
  private async handleSleep(): Promise<void> {
    console.log("System is going to sleep. Cleaning up...");
    await this.cleanup();
  }

  /**
   * Handles the system waking up from sleep.
   */
  private async handleWake(): Promise<void> {
    console.log("System woke up. Reinitializing...");
    if (this.initializedScanningRequest) {
      await this.startScanning();
    }
  }

  /**
   * Sets up graceful shutdown event listeners for the process.
   * @private
   * @returns {void}
   */
  private setupGracefulShutdown(): void {
    const signals = ["SIGINT", "SIGTERM", "SIGUSR2"];

    signals.forEach((signal) => {
      process.on(signal, async () => {
        console.log(`Received ${signal}. Initiating graceful shutdown...`);
        await this.cleanup();
        process.exit(0);
      });
    });

    process.on("uncaughtException", (error) => {
      console.error("Uncaught Exception:", error);
      this.cleanup().finally(() => process.exit(1));
    });

    process.on("unhandledRejection", (reason, promise) => {
      console.error("Unhandled Rejection at:", promise, "reason:", reason);
      this.cleanup().finally(() => process.exit(1));
    });
  }

  /**
   * Cleans up the resources used by the monitor.
   * @returns {Promise<void>}
   */
  public async cleanup(): Promise<void> {
    console.log("Initiating cleanup process...");

    await this.stopScanning();

    const allDevices = [
      ...Array.from(this.discoveredDevices.values()),
      ...Array.from(this.devices.values()),
    ];
    const disconnectionPromises = Array.from(allDevices).map(async (device) => {
      try {
        await device.disconnect();
      } catch (error) {
        console.error(
          `Error disconnecting device ${device.getDeviceInfo().deviceId}:`,
          error
        );
      }
    });

    await Promise.all(disconnectionPromises);

    this.discoveredDevices.clear();
    this.devices.clear();

    if (this.cleanupOldDiscoveredDevicesInterval) {
      clearInterval(this.cleanupOldDiscoveredDevicesInterval);
      this.cleanupOldDiscoveredDevicesInterval = null;
    }

    console.log("Cleanup process completed.");
  }

  /**
   * Resets the adapter ready promise and resolver.
   * @private
   */
  private resetAdapterReadyPromise(): void {
    this.adapterReadyPromise = new Promise((resolve) => {
      this.adapterReadyResolver = resolve;
    });
  }
}

export { MultiDeviceBluetoothHeartRateMonitor, DeviceData };
