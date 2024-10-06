# Multidevice Bluetooth Heart Rate Monitor

A TypeScript library for managing multiple Bluetooth heart rate monitor devices simultaneously.

[![Documentation](https://img.shields.io/badge/documentation-view-blue)](https://yourusername.github.io/your-repo-name/)

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
import { MultiDeviceBluetoothHeartRateMonitor } from "multidevice-bluetooth-heart-rate-monitor";

const monitor = new MultiDeviceBluetoothHeartRateMonitor();

monitor.on("data", (data) => {
  console.log(`Heart rate for device ${data.deviceId}: ${data.heartRate}`);
});

monitor.on("deviceReconnected", (deviceInfo) => {
  console.log(`Device reconnected: ${deviceInfo.deviceName}`);
});

monitor.on("deviceDisconnected", (deviceInfo) => {
  console.log(`Device reconnected: ${deviceInfo.deviceName}`);
});

monitor.startScanning();
```

## API Reference

### `MultiDeviceBluetoothHeartRateMonitor`

The main class for managing multiple heart rate monitor devices.

#### Methods

- `startScanning()`: Start scanning for Bluetooth heart rate monitors.
- `stopScanning()`: Stop scanning for devices.
- `getConnectedDevices()`: Get an array of currently connected devices.

#### Events

- `'data'`: Emitted when heart rate data is received from a device.
- `'deviceReconnected'`: Emitted when a known device is reconnected.
- `'scanStart'`: Emitted when scanning starts.
- `'scanStop'`: Emitted when scanning stops.
- `'error'`: Emitted when an error occurs.

### `BluetoothHeartRateDevice`

Represents a single Bluetooth heart rate monitor device.

#### Methods

- `connect()`: Connect to the device.
- `disconnect()`: Disconnect from the device.
- `getDeviceInfo()`: Get information about the device.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
