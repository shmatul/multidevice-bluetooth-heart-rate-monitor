import { Peripheral, Characteristic } from "@abandonware/noble";
import { EventEmitter } from "events";

interface DeviceData {
  heartRate: number;
  battery?: number;
  deviceId: string;
  manufacturerName?: string;
  serialNumber?: string;
  deviceName: string;
  rssi: number;
}

class BluetoothHeartRateDevice extends EventEmitter {
  private static readonly HRM_SERVICE_UUID = "180D";
  private static readonly HRM_CHARACTERISTIC_UUID = "2A37";
  private static readonly BATTERY_SERVICE_UUID = "180F";
  private static readonly BATTERY_CHARACTERISTIC_UUID = "2A19";
  private static readonly DEVICE_INFO_SERVICE_UUID = "180A";
  private static readonly MANUFACTURER_NAME_CHARACTERISTIC_UUID = "2A29";
  private static readonly SERIAL_NUMBER_CHARACTERISTIC_UUID = "2A25";

  private rssIInterval: NodeJS.Timeout | null = null;
  public peripheral: Peripheral;
  public deviceData: DeviceData;

  constructor(peripheral: Peripheral) {
    super();
    this.peripheral = peripheral;
    this.deviceData = {
      heartRate: 0,
      deviceId: peripheral.id,
      deviceName: peripheral.advertisement?.localName || "Unknown Device",
      rssi: 0,
    };
  }

  public setRSSI() {
    try {
      const rssI = this.peripheral?.rssi;
      const minRSSI = -100;
      const maxRSSI = -50;
      const percentage = Math.max(
        0,
        Math.min(100, ((rssI - minRSSI) / (maxRSSI - minRSSI)) * 100)
      );
      this.deviceData.rssi = percentage;
    } catch (error) {
      console.error(
        "Error reading getting RSSI:",
        error,
        "Device:",
        this.deviceData?.deviceName,
        this.deviceData?.deviceId
      );
      this.deviceData.rssi = 0;
    }
  }

  public async connect(): Promise<void> {
    await this.peripheral.connectAsync();
    this.rssIInterval = setInterval(async () => {
      this.peripheral.updateRssiAsync();
      this.setRSSI();
    }, 1000);
    this.peripheral.once("disconnect", this.handleDisconnect.bind(this));

    const { characteristics } =
      await this.peripheral.discoverAllServicesAndCharacteristicsAsync();

    await this.setupCharacteristics(characteristics);
    await this.readDeviceInfo(characteristics);
  }

  public async disconnect(): Promise<void> {
    if (this.peripheral.state === "connected") {
      console.log(`Disconnecting device: ${this.deviceData.deviceId}`);
      await this.peripheral.disconnectAsync();
    }
  }

  public getDeviceInfo(): DeviceData {
    return { ...this.deviceData };
  }

  private async setupCharacteristics(
    characteristics: Characteristic[]
  ): Promise<void> {
    const heartRateChar = this.findCharacteristic(
      characteristics,
      BluetoothHeartRateDevice.HRM_CHARACTERISTIC_UUID
    );
    const batteryChar = this.findCharacteristic(
      characteristics,
      BluetoothHeartRateDevice.BATTERY_CHARACTERISTIC_UUID
    );

    if (heartRateChar) {
      await heartRateChar.subscribeAsync();
      heartRateChar.on("data", this.handleHeartRateData.bind(this));
      // console.log("Subscribed to heart rate notifications");
    }

    if (batteryChar) {
      await batteryChar.subscribeAsync();
      batteryChar.on("data", this.handleBatteryData.bind(this));
      // console.log("Subscribed to battery notifications");
    }
  }

  private async readDeviceInfo(
    characteristics: Characteristic[]
  ): Promise<void> {
    const manufacturerNameChar = this.findCharacteristic(
      characteristics,
      BluetoothHeartRateDevice.MANUFACTURER_NAME_CHARACTERISTIC_UUID
    );
    const serialNumberChar = this.findCharacteristic(
      characteristics,
      BluetoothHeartRateDevice.SERIAL_NUMBER_CHARACTERISTIC_UUID
    );
    const batteryChar = this.findCharacteristic(
      characteristics,
      BluetoothHeartRateDevice.BATTERY_CHARACTERISTIC_UUID
    );

    if (manufacturerNameChar) {
      this.deviceData.manufacturerName = await this.readCharacteristic(
        manufacturerNameChar,
        "Manufacturer Name"
      );
    }

    if (serialNumberChar) {
      this.deviceData.serialNumber = await this.readCharacteristic(
        serialNumberChar,
        "Serial Number"
      );
    }

    if (batteryChar) {
      await this.readCharacteristic(batteryChar, "Battery Level");
    }

    // console.log("Device Info:", this.deviceData);
  }

  private findCharacteristic(
    characteristics: Characteristic[],
    uuid: string
  ): Characteristic | undefined {
    return characteristics.find(
      (c) => c.uuid.toLowerCase() === uuid.toLowerCase()
    );
  }

  private async readCharacteristic(
    characteristic: Characteristic,
    name: string
  ): Promise<string | undefined> {
    try {
      const data = await characteristic.readAsync();
      return data.toString().replace(/\0+$/, "");
    } catch (error) {
      console.error(`Error reading ${name}:`, error);
      return undefined;
    }
  }

  private handleBatteryData(data: Buffer): void {
    if (data.length === 0) {
      console.error("Received empty buffer for battery data");
      return;
    }

    const rawValue = data.readUInt8(0);
    // console.log("Raw battery value:", rawValue);

    if (rawValue >= 0 && rawValue <= 100) {
      this.deviceData.battery = rawValue;
      // console.log("Battery level updated:", this.deviceData.battery);
    } else {
      console.error("Invalid battery value received:", rawValue);
    }

    this.emitData();
  }

  private handleHeartRateData(data: Buffer): void {
    this.deviceData.heartRate = this.parseHeartRate(data);
    this.emitData();
  }

  private emitData(): void {
    this.emit("data", this.deviceData);
  }

  private parseHeartRate(data: Buffer): number {
    const flag = data[0] & 0x01;
    if (flag === 0) {
      return data.readUInt8(1);
    } else {
      return data.readUInt16LE(1);
    }
  }

  private async handleDisconnect(): Promise<void> {
    console.log(`Device ${this.deviceData.deviceId} disconnected.`);
    if (this.rssIInterval) {
      clearInterval(this.rssIInterval);
      this.rssIInterval = null;
    }
    this.emit("disconnect", this.deviceData.deviceId);
  }
}

export { BluetoothHeartRateDevice, DeviceData };
