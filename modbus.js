const ERROR = {
  0x01: 'Принятый код функции не может быть обработан.',
  0x02: 'Адрес данных, указанный в запросе, недоступен.',
  0x03: 'Значение, содержащееся в поле данных запроса, является недопустимой величиной.',
  0x04: 'Невосстанавливаемая ошибка имела место, пока ведомое устройство пыталось выполнить затребованное действие.',
  0x05: 'Ведомое устройство приняло запрос и обрабатывает его, но это требует много времени.'
  + ' Этот ответ предохраняет ведущее устройство от генерации ошибки тайм-аута.',
  0x06: 'Ведомое устройство занято обработкой команды. Ведущее устройство должно повторить сообщение позже, когда ведомое освободится.',
  0x07: 'Ведомое устройство не может выполнить программную функцию, заданную в запросе.'
  + ' Этот код возвращается для неуспешного программного запроса, использующего функции с номерами 13 или 14.'
  + ' Ведущее устройство должно запросить диагностическую информацию или информацию об ошибках от ведомого.',
  0x08: 'Ведомое устройство при чтении расширенной памяти обнаружило ошибку паритета.'
  + 'Ведущее устройство может повторить запрос, но обычно в таких случаях требуется ремонт.',
}

const CODE = {
  // русский формат, цифровые и дискретные входы/выходы
  readDigitalOutputs: 0x01,
  readDigitalInputs: 0x02,
  readAnalogOutputs: 0x03,
  readAnalogInputs: 0x04,
  writeSingleDigitalOutput: 0x05,
  writeSingleAnalogOutput: 0x06,
  writeMultipleDigitalOutputs: 0x0F,
  writeMultipleAnalogOutputs: 0x10,

  // международный формат
  readCoils: 0x01,
  readDescreteInputs: 0x02,
  readHoldingRegisters: 0x03,
  readInputRegisters: 0x04,
  writeSingleCoil: 0x05,
  writeSingleHoldingRegister: 0x06,
  writeMultipleCoils: 0x0F,
  writeMultipleHoldingRegisters: 0x10,
}

function crc16(buffer) {
  let crc = 0xFFFF
  let odd

  for (let i = 0; i < buffer.length; i += 1) {
    crc ^= buffer[i]

    for (let j = 0; j < 8; j += 1) {
      odd = crc & 0x0001
      crc >>= 1
      if (odd) {
        crc ^= 0xA001
      }
    }
  }
  return crc
}

function buildRead(unitId, funcCode, address, quantity) {
  if (funcCode < 0x01 || funcCode > 0x04) { throw new Error('error code read') }

  const buffer = Buffer.alloc(8)
  buffer.writeUInt8(unitId, 0)
  buffer.writeUInt8(funcCode, 1)
  buffer.writeUInt16BE(address, 2)
  buffer.writeUInt16BE(quantity, 4)
  buffer.writeUInt16LE(crc16(buffer.slice(0, -2)), 6)
  return buffer
}

function arrToBuffer(arr, blockLength = 8) {
  const buffer = Buffer.alloc(blockLength * arr.length)
  let offset = 0
  for (let i = 0; i < arr.length; i += 1) {
    arr[i].copy(buffer, offset)
    offset += 8
  }

  return buffer
}

function parseResponse(buffer) {
  let result = null

  let lenBuffer = buffer.length
  lenBuffer -= 2

  const crcOriginal = buffer.readUInt16LE(lenBuffer)
  const crcCheck = crc16(buffer.slice(0, -2))
  if (crcOriginal !== crcCheck) {
    // TODO: Обработка ошибки битой контрольной суммы пакета
    throw new Error('error crc parse')
  }

  const unitId = buffer.readUInt8(0)
  const error = (buffer[1] & (1 << 7)) ? 1 : 0
  if (error === 1) {
    const errorCode = buffer.readUInt8(2)
    // TODO: Обработка ошибки в ответе от ПЛК
    throw new Error(`error modbus: ${ERROR[errorCode]}`)
  }

  const funcCode = buffer.readUInt8(1)

  lenBuffer -= 3

  switch (funcCode) {
  case CODE.readCoils:
  case CODE.readDescreteInputs:
    // eslint-disable-next-line no-case-declarations
    const bytesCount = Math.min(lenBuffer, buffer.readUInt8(2))

    for (let i = 3; i < bytesCount + 3; i += 1) {
      for (let j = 0; j < 8; j += 1) {
        const byteValue = (buffer[i] & (1 << j)) ? 1 : 0
        result = {
          deviceId: 23, unitId, funcCode, register: byteValue,
        }
      }
    }
    break
  case CODE.readHoldingRegisters:
  case CODE.readInputRegisters:
    // eslint-disable-next-line no-case-declarations
    const blocksCount = Math.min(lenBuffer / 2, buffer.readUInt8(2) / 2)
    for (let i = 3; i < blocksCount + 4; i += 2) {
      const blockValue = buffer.readUInt16BE(i)
      result = {
        deviceId: 23, unitId, funcCode, register: blockValue,
      }
    }
    break
  default:
    // TODO: Обработка ошибки некорректной функции
    throw new Error('error code function incorrect')
  }

  return result
}

function build(unitId, funcCode, data) {
  const buffer = Buffer.alloc(data.length + 4)

  buffer.writeUInt8(unitId, 0)
  buffer.writeUInt8(funcCode, 1)
  Buffer.from(data).copy(buffer, 2)
  buffer.writeUInt16LE(crc16(buffer.slice(0, -2)), data.length - 2)

  return buffer
}

module.exports = {
  CODE,
  ERROR,
  crc16,
  buildRead,
  build,
  arrToBuffer,
  parseResponse,
}
