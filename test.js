const {
  setupDevice,
  transferDataOut,
  transferDataIn,
  buildFrame
} = require('./index')

const sendQueue = []

const drainSendQueue = async (outEndpoint) => {
  while (sendQueue.length) {
    const frame = sendQueue.shift()
    await transferDataOut(outEndpoint, frame)
    console.log(`> ${frame.toString('hex')}`)
  }
}

const run = async () => {
  const vendorId = 0x1D50
  const deviceId = 0x606F
  const arbitrationId = 0x7E0
  const message = [
    0x03,
    0x22,
    0xF1,
    0x21,
    0x00,
    0x00,
    0x00,
    0x00
  ]
  const { inEndpoint, outEndpoint } = await setupDevice(vendorId, deviceId)
  sendQueue.push(buildFrame(arbitrationId, message))
  for (;;) {
    await drainSendQueue(outEndpoint)
    const frame = await transferDataIn(inEndpoint, 0x14)
    console.log(`< ${frame.toString('hex')}`)
  }
}

run()
