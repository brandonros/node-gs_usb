const proxyquire = require('proxyquire')

let inTransferIndex = 0
const inTransferMocks = [
  Buffer.from('FFFFFFFF112233440800000011223344556677', 'hex')
]

const claim = () => {

}

const open = () => {

}

const controlTransfer = (bmRequestType, bRequest, wValue, wIndex, data, cb) => {
  cb(null, undefined)
}

class InEndpoint {
  constructor() {

  }

  transfer(length, cb) {
    if (inTransferMocks[inTransferIndex]) {
      setTimeout(() => {
        cb(null, inTransferMocks[inTransferIndex])
        inTransferIndex += 1
      }, 1000)
    }
  }
}

class OutEndpoint {
  constructor() {

  }

  transfer(frame, cb) {
    console.log(`OutEndpoint: ${frame.toString('hex')}`)
    cb(null, undefined)
  }
}

const getDeviceList = () => {
  return [
    {
      deviceDescriptor: {
        idProduct: 0x606F,
        idVendor: 0x1D50
      },
      controlTransfer,
      interfaces: [
        {
          claim,
          endpoints: [
            new InEndpoint(),
            new OutEndpoint()
          ],
          descriptor: {
            bInterfaceNumber: 1
          }
        }
      ],
      open
    }
  ]
}

const GsUsb = proxyquire('./index.js', {
  usb: {
    getDeviceList
  }
})

const run = async () => {
  const gsUsb = new GsUsb(115200, 1000000)
  gsUsb.on('frame', (frame) => {
    console.log(frame)
  })
  await gsUsb.init()
  gsUsb.sendCanFrame(0x11223344, Buffer.from('0700112233445566', 'hex'))
  gsUsb.recv()
  await new Promise(resolve => setTimeout(resolve, 1000))
}

run()
