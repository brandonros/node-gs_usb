const { setupDevice, transferDataOut, transferDataIn } = require('./index')

const run = async () => {
  const { inEndpoint, outEndpoint } = await setupDevice(0x1d50, 0x606f)
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
  const frameLength = 0x14
  const data = new ArrayBuffer(frameLength)
  const dataView = new DataView(data)
  dataView.setUint32(0x00, 0xffffffff, true) // echo_id
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
  await transferDataOut(outEndpoint, Buffer.from(data))
  for (;;) {
    const frame = await transferDataIn(inEndpoint, 0x14)
    console.log(`< ${frame.toString('hex')}`)
  }
}

run()
