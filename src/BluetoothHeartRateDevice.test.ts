import { BluetoothHeartRateDevice } from "./BluetoothHeartRateDevice";

describe("BluetoothHeartRateDevice", () => {
  it("should create an instance", () => {
    const mockPeripheral: any = {
      id: "test-id",
      advertisement: { localName: "Test Device" },
    };
    const device = new BluetoothHeartRateDevice(mockPeripheral);
    expect(device).toBeInstanceOf(BluetoothHeartRateDevice);
  });

  // Add more tests here as needed
});
