const mode = (typeof window === 'undefined') ? 'node' : 'browser'
const Buffer = mode === 'browser' ? require('./node_modules/buffer/index').Buffer : global.Buffer
const EventEmitter = mode === 'browser' ? require('./node_modules/events/events') : require('events')
const usb = mode === 'browser' ? navigator.usb : require('webusb').usb

const GS_USB_BREQ_HOST_FORMAT = 0
const GS_USB_BREQ_MODE = 2

const GS_CAN_MODE_RESET = 0
const GS_CAN_MODE_START = 1

const GS_CAN_MODE_PAD_PKTS_TO_MAX_PKT_SIZE = (1 << 7)

const USB_DIR_OUT = 0
const USB_TYPE_VENDOR = (0x02 << 5)
const USB_RECIP_INTERFACE = 0x01

const VENDOR_ID = 0x1D50
const PRODUCT_ID = 0x606F

class GsUsb extends EventEmitter {
  constructor() {
    super()
  }

  setDeviceMode(mode, flags) {
    const data = Buffer.alloc(8)
    data.writeUInt32LE(mode, 0) // mode
    data.writeUInt32LE(flags, 4) // flags
    return this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'interface',
      request: GS_USB_BREQ_MODE,
      value: 0x00, // https://github.com/torvalds/linux/blob/master/drivers/net/can/usb/gs_usb.c#L255
      index: this.device.configurations[0].interfaces[0].interfaceNumber
    }, data)
  }

  sendHostConfig() {
    const data = Buffer.alloc(4)
    data.writeUInt32LE(0xEFBE0000, 0)
    return this.device.controlTransferOut({
      requestType: 'vendor',
      recipient: 'interface',
      request: GS_USB_BREQ_HOST_FORMAT,
      value: 0x01, // https://github.com/torvalds/linux/blob/master/drivers/net/can/usb/gs_usb.c#L920,
      index: this.device.configurations[0].interfaces[0].interfaceNumber
    }, data)
  }

  async recv() {
    for (;;) {
      const transferInResult = await this.device.transferIn(this.inEndpoint.endpointNumber, this.inEndpoint.packetSize)
      const frame = Buffer.from(transferInResult.data.buffer)
      const arbitrationId = frame.readUInt32LE(4) & 0x1FFFFFFF
      const data = frame.slice(12, 12 + 8)
      const output = Buffer.alloc(12)
      output.writeUInt32LE(arbitrationId, 0)
      data.copy(output, 4)
      this.emit('frame', output)
    }
  }

  async sendCanFrame(arbitrationId, data) {
    const frame = Buffer.alloc(0x14)
    frame.writeUInt32LE(0xFFFFFFFF, 0x00) // echo_id
    frame.writeUInt32LE(arbitrationId > 0x7FF ? ((0x80000000 | arbitrationId) >>> 0) : arbitrationId, 0x04) // can_id
    frame.writeUInt8(0x08, 0x08) // can_dlc
    frame.writeUInt8(0x00, 0x09) // channel
    frame.writeUInt8(0x00, 0x0A) // flags
    frame.writeUInt8(0x00, 0x0B) // reserved
    frame.writeUInt8(data[0], 0x0C)
    frame.writeUInt8(data[1], 0x0D)
    frame.writeUInt8(data[2], 0x0E)
    frame.writeUInt8(data[3], 0x0F)
    frame.writeUInt8(data[4], 0x10)
    frame.writeUInt8(data[5], 0x11)
    frame.writeUInt8(data[6], 0x12)
    frame.writeUInt8(data[7], 0x13)
    return this.device.transferOut(this.outEndpoint.endpointNumber, frame)
  }

  async getUsbDevice() {
    const device = await usb.requestDevice({
      filters: [
        {
          vendorId: VENDOR_ID,
          productId: PRODUCT_ID
        }
      ]
    })
    await device.open()
    const [ configuration ] = device.configurations
    if (device.configuration === null) {
      await device.selectConfiguration(configuration.configurationValue)
    }
    await device.claimInterface(configuration.interfaces[0].interfaceNumber)
    await device.selectAlternateInterface(configuration.interfaces[0].interfaceNumber, 0)
    return device
  }

  async init() {
    this.device = await this.getUsbDevice()
    this.inEndpoint = this.device.configuration.interfaces[0].alternates[0].endpoints.find(e => e.direction === 'in')
    this.outEndpoint = this.device.configuration.interfaces[0].alternates[0].endpoints.find(e => e.direction === 'out')
    await this.setDeviceMode(GS_CAN_MODE_RESET, 0x00000000)
    await this.sendHostConfig()
    await this.setDeviceMode(GS_CAN_MODE_START, 0x00000000)
  }
}

module.exports = GsUsb
