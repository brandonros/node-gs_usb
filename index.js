const usb = require('usb')
const util = require('util')
const debug = require('debug')('node-gs_usb')
const EventEmitter = require('events')

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
    debug('resetDevice')
    const bmRequestType = USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
    const bRequest = GS_USB_BREQ_MODE
    const wValue = 0 // https://github.com/torvalds/linux/blob/master/drivers/net/can/usb/gs_usb.c#L255
    const wIndex = this.device.interfaces[0].descriptor.bInterfaceNumber
    const data = Buffer.alloc(8)
    data.writeUInt32LE(mode, 0) // mode
    data.writeUInt32LE(flags, 4) // flags
    return this.device.controlTransfer(
      bmRequestType,
      bRequest,
      wValue,
      wIndex,
      data
    )
  }

  sendHostConfig() {
    debug('sendHostConfig')
    const bmRequestType = USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
    const bRequest = GS_USB_BREQ_HOST_FORMAT
    const wValue = 1 // https://github.com/torvalds/linux/blob/master/drivers/net/can/usb/gs_usb.c#L920
    const wIndex = this.device.interfaces[0].descriptor.bInterfaceNumber
    const data = Buffer.alloc(4)
    data.writeUInt32LE(0xEFBE0000, 0)
    return this.device.controlTransfer(
      bmRequestType,
      bRequest,
      wValue,
      wIndex,
      data
    )
  }

  async recv() {
    for (;;) {
      const frame = await this.inEndpoint.transfer(32)
      const arbitrationId = frame.readUInt32LE(4)
      const data = frame.slice(12, 12 + 8)
      this.emit('frame', {
        arbitrationId,
        data
      })
    }
  }

  async sendCanFrame(arbitrationId, data) {
    const frameLength = 0x14
    const frame = new ArrayBuffer(frameLength)
    const dataView = new DataView(frame)
    dataView.setUint32(0x00, 0xFFFFFFFF, true) // echo_id
    dataView.setUint32(0x04, arbitrationId, true) // can_id
    dataView.setUint8(0x08, 0x08) // can_dlc
    dataView.setUint8(0x09, 0x00) // channel
    dataView.setUint8(0x0A, 0x00) // flags
    dataView.setUint8(0x0B, 0x00) // reserved
    dataView.setUint8(0x0C, data[0])
    dataView.setUint8(0x0D, data[1])
    dataView.setUint8(0x0E, data[2])
    dataView.setUint8(0x0F, data[3])
    dataView.setUint8(0x10, data[4])
    dataView.setUint8(0x11, data[5])
    dataView.setUint8(0x12, data[6])
    dataView.setUint8(0x13, data[7])
    return this.outEndpoint.transfer(Buffer.from(frame))
  }

  getUsbDevice() {
    const deviceList = usb.getDeviceList()
    const device = deviceList.find(device => {
      return device.deviceDescriptor.idProduct === PRODUCT_ID &&
        device.deviceDescriptor.idVendor === VENDOR_ID
    })
    if (!device) {
      throw new Error('Device not found')
    }
    device.open()
    device.interfaces[0].claim()
    return device
  }

  async init() {
    this.device = this.getUsbDevice()
    this.inEndpoint = this.device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'InEndpoint')
    this.outEndpoint = this.device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'OutEndpoint')
    this.device.controlTransfer = util.promisify(this.device.controlTransfer)
    this.inEndpoint.transfer = util.promisify(this.inEndpoint.transfer)
    this.outEndpoint.transfer = util.promisify(this.outEndpoint.transfer)
    await this.setDeviceMode(GS_CAN_MODE_RESET, 0x00000000)
    await this.sendHostConfig()
    await this.setDeviceMode(GS_CAN_MODE_START, 0x00000000)
  }
}

module.exports = GsUsb
