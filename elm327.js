const usb = require('usb')
const util = require('util')
const debug = require('debug')('node-gs_usb')
const EventEmitter = require('events')

const USB_DIR_OUT = 0x00
const USB_DIR_IN = 0x80

const USB_TYPE_STANDARD = (0x00 << 5)
const USB_TYPE_CLASS = (0x01 << 5)
const USB_TYPE_VENDOR = (0x02 << 5)

const USB_RECIP_DEVICE = 0x00
const USB_RECIP_INTERFACE = 0x01

const VENDOR_READ_REQUEST = 0x01
const VENDOR_WRITE_REQUEST = 0x01
const SET_LINE_REQUEST = 0x20
const SET_CONTROL_REQUEST = 0x22

const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms))

const vendorRead = (device, wValue, wIndex, length) => {
  debug(`vendorRead wValue=${wValue.toString(16)} wIndex=${wIndex.toString(16)} length=${length.toString(16)}`)
  const bmRequestType =  USB_DIR_IN | USB_TYPE_VENDOR | USB_RECIP_DEVICE
  const bRequest = VENDOR_READ_REQUEST
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    length
  )
}

const vendorWrite = (device, wValue, wIndex) => {
  debug(`vendorWrite wValue=${wValue.toString(16)} wIndex=${wIndex.toString(16)}`)
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_VENDOR | USB_RECIP_DEVICE
  const bRequest = VENDOR_WRITE_REQUEST
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    Buffer.alloc(0)
  )
}

const setLine = (device, wValue, wIndex, data) => {
  debug(`setLine wValue=${wValue.toString(16)} wIndex=${wIndex.toString(16)} data=${data.toString('hex')}`)
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_CLASS | USB_RECIP_INTERFACE
  const bRequest = SET_LINE_REQUEST
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    data
  )
}

const setControl = (device, wValue, wIndex) => {
  debug(`setControl wValue=${wValue.toString(16)} wIndex=${wIndex.toString(16)}`)
  const bmRequestType =  USB_DIR_OUT | USB_TYPE_CLASS | USB_RECIP_INTERFACE
  const bRequest = SET_CONTROL_REQUEST
  return device.controlTransfer(
    bmRequestType,
    bRequest,
    wValue,
    wIndex,
    Buffer.alloc(0)
  )
}

const transferDataOut = (outEndpoint, frame) => {
  debug('transferDataOut')
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
  debug('transferDataIn')
  return new Promise((resolve, reject) => {
    inEndpoint.transfer(length, (err, res) => {
      if (err) {
        return reject(err)
      }
      resolve(res)
    })
  })
}

const readLoop = async (inEndpoint, maxFrameLength, cb) => {
  const frame = await transferDataIn(inEndpoint, maxFrameLength)
  cb(frame)
  readLoop(inEndpoint, maxFrameLength, cb)
}

const setupDevice = async (device) => {
  await vendorRead(device, 0x8484, 0x0000, 1)
  await vendorWrite(device, 0x404, 0x0000)
  await vendorRead(device, 0x8484, 0x0000, 1)
  await vendorRead(device, 0x8383, 0x0000, 1)
  await vendorRead(device, 0x8484, 0x0000, 1)
  await vendorWrite(device, 0x404, 0x0001)
  await vendorRead(device, 0x8484, 0x0000, 1)
  await vendorRead(device, 0x8383, 0x0000, 1)
  await vendorWrite(device, 0x0, 0x0001)
  await vendorWrite(device, 0x1, 0x0000)
  await vendorWrite(device, 0x2, 0x0044)
  await vendorRead(device, 0x80, 0x0000, 2)
  await vendorWrite(device, 0x0, 0x0001)
  await setControl(device, 0x1, 0x0000)
  await vendorRead(device, 0x80, 0x0000, 2)
  await vendorWrite(device, 0x0, 0x0001)
  await setControl(device, 0x3, 0x0000)
  await vendorRead(device, 0x80, 0x0000, 2)
  await vendorWrite(device, 0x0, 0x0001)
  await vendorRead(device, 0x80, 0x0000, 2)
  await vendorWrite(device, 0x0, 0x0001)
  await vendorWrite(device, 0xB0B, 0x0002)
  await vendorWrite(device, 0x909, 0x0000)
  await vendorWrite(device, 0x808, 0x0000)
  await setLine(device, 0x0, 0x0000, Buffer.from('00960000000007', 'hex'))
  await setControl(device, 0x1, 0x0000)
  await setControl(device, 0x0, 0x0000)
  await setLine(device, 0x0, 0x0000, Buffer.from('00960000000008', 'hex'))
  await vendorWrite(device, 0x505, 0x1311)
  await setControl(device, 0x0, 0x0000)
  await setControl(device, 0x0, 0x0000)
  await vendorRead(device, 0x80, 0x0000, 2)
  await vendorWrite(device, 0x0, 0x0001)
}

const run = async (vendorId, productId) => {
  //usb.setDebugLevel(4)
  const deviceList = usb.getDeviceList()
  const device = deviceList.find(device => {
    return device.deviceDescriptor.idProduct === productId && device.deviceDescriptor.idVendor === vendorId
  })
  if (!device) {
    throw new Error('Device not found')
  }
  device.open()
  device.interfaces[0].claim()
  device.controlTransfer = util.promisify(device.controlTransfer)
  await setupDevice(device)
  const inEndpoint = device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'InEndpoint' && endpoint.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK)
  const outEndpoint = device.interfaces[0].endpoints.find(endpoint => endpoint.constructor.name === 'OutEndpoint' && endpoint.transferType === usb.LIBUSB_TRANSFER_TYPE_BULK)
  const queue = []
  let frame = []
  readLoop(inEndpoint, 256, (chunk) => {
    for (let i = 0; i < chunk.length; ++i) {
      if (chunk[i] === 0x0D) {
        if (frame.length) {
          queue.push(Buffer.from(frame))
        }
        frame = []
      } else {
        frame.push(chunk[i])
      }
    }
  })
  await transferDataOut(outEndpoint, 'ATZ\r')
  await delay(500)
  await transferDataOut(outEndpoint, 'ATD\r')
  await delay(500)
  await transferDataOut(outEndpoint, 'ATE0\r')
  await delay(500)
  await transferDataOut(outEndpoint, 'ATI\r')
  await delay(500)
  console.log(queue)
}

run(0x067B, 0x2303)

process.on('unhandledRejection', (err) => {
  console.error(err.stack)
})