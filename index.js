const { test } = require('tap')

test('modbus rtu plk', (t) => {
  const M = require('./modbus')

  const b1 = M.buildRead(1, M.CODE.readInputRegisters, 1, 3)
  t.strictSame(b1, Buffer.from([0x01, 0x04, 0x00, 0x01, 0x00, 0x03, 0xe1, 0xcb]))

  const b2 = M.buildRead(1, M.CODE.readCoils, 1, 8)
  t.strictSame(b2, Buffer.from([0x01, 0x01, 0x00, 0x01, 0x00, 0x08, 0x6c, 0x0c]))

  const b3seed = [0x01, 0x03, 0x04, 0x00, 0x7a, 0x00, 0x7a]
  const b3 = Buffer.alloc(9)
  Buffer.from(b3seed).copy(b3, 0)
  b3.writeUInt16LE(M.crc16(b3.slice(0, -2)), b3.length - 2)

  t.strictSame(b3, Buffer.from([0x01, 0x03, 0x04, 0x00, 0x7a, 0x00, 0x7a, 0x5a, 0x09]))

  t.strictSame(M.parseResponse(b3), {
    deviceId: 23, unitId: 1, funcCode: 3, register: 122,
  })

  t.strictSame(M.arrToBuffer([b1, b2]).reverse(), M.arrToBuffer([b2.reverse(), b1.reverse()]))

  t.end()
})
