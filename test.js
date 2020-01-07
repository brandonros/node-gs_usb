const devices = {
  canalyze: {
    vendorId: 0x0483,
    productId: 0x1234
  },
  canable: {
    vendorId: 0x1d50,
    productId: 0x606f
  },
  cantact: {
    vendorId: 0x1d50,
    productId: 0x606f
  }
}

const { start, addListener, send } = require('./index')

const idsWritten = new Set()

const run = async (deviceName) => {
  const { vendorId, productId } = devices[deviceName]
  await start(vendorId, productId)
  addListener('listener', (frame) => {
    const id = frame.id.toString(16).padStart(3, '0')
    if (!idsWritten.has(id)) {
      console.log(id)
      idsWritten.add(id)
    }
  })
  /*setInterval(async () => {
    const frame = Buffer.from([0x03, 0x22, 0xF1, 0x90, 0x00, 0x00, 0x00, 0x00])
    await send({ id: 0x7E0, data: frame })
  }, 1000)*/
}

run('cantact')