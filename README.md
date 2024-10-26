# Multidevice Bluetooth Heart Rate Monitor

A TypeScript library for managing multiple Bluetooth heart rate monitor devices simultaneously.

Documentation:
[![Documentation](https://img.shields.io/badge/documentation-view-blue)](https://shmatul.github.io/multidevice-bluetooth-heart-rate-monitor/)

This package is based on the following:

- [@abandonware/noble](https://www.npmjs.com/package/@abandonware/noble)

## Features

- Connect to multiple Bluetooth heart rate monitors
- Real-time heart rate data streaming
- Battery level monitoring (if supported by the device)
- Automatic reconnection to known devices
- Event-based architecture for easy integration

## Installation

```bash
npm install multidevice-bluetooth-heart-rate-monitor
```

## Usage

Here's a basic example of how to use the library:

```typescript
import {
  MultiDeviceBluetoothHeartRateMonitor,
  BluetoothHeartRateDevice,
  DeviceData,
} from "multidevice-bluetooth-heart-rate-monitor";

const monitor = new MultiDeviceBluetoothHeartRateMonitor();

monitor.on("data", (data: DeviceData) => {
  console.log(`Heart rate for device ${data.deviceId}: ${data.heartRate}`);
});

monitor.on("deviceConnected", (device: BluetoothHeartRateDevice) => {
  console.log(`Device connected: ${device.getDeviceInfo().deviceId}`);
});

monitor.on("deviceDisconnected", (device: BluetoothHeartRateDevice) => {
  console.log(`Device disconnected: ${device.getDeviceInfo().deviceId}`);
});

monitor.on("deviceDiscovered", (device: BluetoothHeartRateDevice) => {
  console.log(`Device discovered: ${device.getDeviceInfo().deviceId}`);
  try {
    console.log("connecting to device...");
    await monitor.connectDevice(device);
  } catch (error) {
    console.error(error);
  }
});

monitor.on("adapterStateChange", (state: string) => {
  console.log(`Bluetooth adapter state changed: ${state}`);
});

monitor.startScanning();
```

## API Reference

### `MultiDeviceBluetoothHeartRateMonitor`

The main class for managing multiple heart rate monitor devices.

#### Methods

- `startScanning()`: Start scanning for Bluetooth heart rate monitors.
- `stopScanning()`: Stop scanning for devices.
- `getDiscoveredDevices()`: Get an array of currently discovered devices.
- `getConnectedDevices()`: Get an array of currently connected devices.
- `connectDevice(DeviceData)`: Connect a discovered device.

#### Events

- `'deviceDiscovered'`: Emitted when a new device is discovered.
- `'discoveredDeviceLost'`: Emitted when a discovered device isn't available anymore.
- `'data'`: Emitted when heart rate data is received from a device.
- `'deviceConnected'`: Emitted when a known device is reconnected.
- `'deviceDisconnected'`: Emitted when a known device is reconnected.
- `'scanStart'`: Emitted when scanning starts.
- `'scanStop'`: Emitted when scanning stops.
- `'error'`: Emitted when an error occurs.
- `'adapterReady'`: Emitted when the bluetooth adapter is ready.

### `BluetoothHeartRateDevice`

Represents a single Bluetooth heart rate monitor device.

#### Methods

- `getDeviceInfo()`: Get information about the device.
- `disconnect()`: Disconnect from the device.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
