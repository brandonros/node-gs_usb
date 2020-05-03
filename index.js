const usb = require('usb')
const util = require('util')
const debug = require('debug')('node-gs_usb')

const GS_USB_BREQ_HOST_FORMAT = 0
const GS_USB_BREQ_MODE = 2

const GS_CAN_MODE_RESET = 0
const GS_CAN_MODE_START = 1

const GS_CAN_MODE_PAD_PKTS_TO_MAX_PKT_SIZE = (1 << 7)

const USB_DIR_OUT = 0
const USB_TYPE_VENDOR = (0x02 << 5)
const USB_RECIP_INTERFACE = 0x01

const setDeviceMode = (device, mode, flags) => {
  debug('resetDevice')
  const bmRequestType = USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_MODE
  const wValue = 0 // https://github.com/torvalds/linux/blob/master/drivers/net/can/usb/gs_usb.c#L255
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const data = Buffer.alloc(8)
  data.writeUInt32LE(mode, 0) // mode
  data.writeUInt32LE(flags, 4) // flags
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    data
  )
}

const sendHostConfig = (device) => {
  debug('sendHostConfig')
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_INTERFACE
  const bRequest = GS_USB_BREQ_HOST_FORMAT
  const wValue = 1 // https://github.com/torvalds/linux/blob/master/drivers/net/can/usb/gs_usb.c#L920
  const wIndex = device.interfaces[0].descriptor.bInterfaceNumber
  const data = Buffer.alloc(4)
  data.writeUInt32LE(0xEFBE0000, 0)
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    data
  )
}

const buildFrame = (arbitrationId, message) => {
  const frameLength = 0x14
  const data = new ArrayBuffer(frameLength)
  const dataView = new DataView(data)
  dataView.setUint32(0x00, 0xFFFFFFFF, true) // echo_id
  dataView.setUint32(0x04, arbitrationId, true) // can_id
  dataView.setUint8(0x08, 0x08) // can_dlc
  dataView.setUint8(0x09, 0x00) // channel
  dataView.setUint8(0x0A, 0x00) // flags
  dataView.setUint8(0x0B, 0x00) // reserved
  dataView.setUint8(0x0C, message[0])
  dataView.setUint8(0x0D, message[1])
  dataView.setUint8(0x0E, message[2])
  dataView.setUint8(0x0F, message[3])
  dataView.setUint8(0x10, message[4])
  dataView.setUint8(0x11, message[5])
  dataView.setUint8(0x12, message[6])
  dataView.setUint8(0x13, message[7])
  return Buffer.from(data)
}

const parseFrame = (frame) => {
  const arbitrationId = frame.readUInt32LE(4)
  const payload = frame.slice(12)
  return {
    arbitrationId,
    payload
  }
}

const transferDataOut = (outEndpoint, frame) => {
  debug(`transferDataOut frame=${frame.toString('hex')}`)
  return new Promise((resolve, reject) => {
    outEndpoint.transfer(frame, (err) => {
      if (err) {
        return reject(err)
      }
      resolve()
    })
  })
}

const transferDataIn = (inEndpoint, length) => {
  return new Promise((resolve, reject) => {
    inEndpoint.transfer(length, (err, frame) => {
      if (err) {
        return reject(err)
      }
      debug(`transferDataIn frame=${frame.toString('hex')}`)
      resolve(frame)
    })
  })
}

const setupDevice = async (vendorId, productId) => {
  //usb.setDebugLevel(4)
  const deviceList = usb.getDeviceList()
  const device = deviceList.find(device => {
    return device.deviceDescriptor.idProduct === productId &&
      device.deviceDescriptor.idVendor === vendorId
  })
  if (!device) {
    throw new Error('Device not found')
  }
  device.open()
  device.interfaces[0].claim()
  device.controlTransfer = util.promisify(device.controlTransfer)
  const inEndpoint = device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'InEndpoint')
  const outEndpoint = device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'OutEndpoint')
  await setDeviceMode(device, GS_CAN_MODE_RESET, 0x00000000)
  await sendHostConfig(device)
  await setDeviceMode(device, GS_CAN_MODE_START, 0x00000000)
  return {
    inEndpoint,
    outEndpoint
  }
}

module.exports = {
  setupDevice,
  transferDataOut,
  transferDataIn,
  buildFrame,
  parseFrame
}
