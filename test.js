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

const run = async (deviceName) => {
  const { vendorId, productId } = devices[deviceName]
  await start(vendorId, productId)
}

run('cantact')
