const log = require('./log').log

const connections = {}
const partner = {}
const messagesFor = {}

// 处理 xhr 请求以使用给定密钥进行连接
function connect(info) {
  const res = info.res
  const query = info.query
  let thisconnection
  /**
   * 创建一个大的随机数字，并且保证这个数字不会在服务器的存活过程中重复出现
   */
  const newID = function () {
    return Math.floor(Math.random() * 1000000000)
  }
  const connectFirstParty = function () {
    if (thisconnection.staus === 'connected') {
      // 删除配对和任何存储的消息
      delete partner[thisconnection.ids[0]]
      delete partner[thisconnection.ids[1]]
      delete messagesFor[thisconnection.ids[0]]
      delete messagesFor[thisconnection.ids[1]]
    }
    connections[query.key] = {}
    thisconnection = connections[query.key]
    thisconnection.staus = 'waiting'
    thisconnection.ids = [newID()]
    webrtcResponse({ id: thisconnection[0], status: thisconnection.status }, res)
  }
  const connectSecondParty = function () {
    thisconnection.ids[1] = newID()
    partner[thisconnection.ids[0]] = thisconnection.ids[1]
    partner[thisconnection.ids[1]] = thisconnection.ids[0]
    messagesFor[thisconnection.ids[0]] = []
    messagesFor[thisconnection.ids[1]] = []
    thisconnection.status = 'connected'
    webrtcResponse({ id: thisconnection.ids[1], status: thisconnection.status }, res)
  }
  log(`Request handler 'connect' was called.`)
  if (query && query.key) {
    thisconnection = connections[query.key] || { status: 'new' }
    if (thisconnection.status === 'waiting') {
      // 前半部分准备就绪
      connectSecondParty()
      return
    } else {
      // 必须为新连接或 connected 状态
      connectFirstParty()
      return
    }
  } else {
    webrtcError('No recognizable query key', res)
  }
}

// 对 info.postData.message 中的消息排队
// 以发送至具有 info.postData.id 中的 ID 的伙伴
function sendMessage(info) {
  log(`postData received is ***${info.postData}***`)
  const postData = JSON.parse(info.postData)
  const res = info.res

  if (typeof postData === 'undefined') {
    webrtcError('No posted data in JSON format!', res)
    return
  }
  if (typeof postData.message === 'undefined') {
    webrtcError('No message received', res)
    return
  }
  if (typeof postData.id === 'undefined') {
    webrtcError('No id received with message', res)
    return
  }
  if (typeof partner[postData.id] === 'undefined') {
    webrtcError(`Invalid id ${postData.id}`, res)
    return
  }
  if (typeof messagesFor[partner[postData.id]] === 'undefined') {
    webrtcError(`Invalid id ${postData.id}`, res)
    return
  }
  messagesFor[partner[postData.id]].push(postData.message)
  log(`Saving message ***${postData.message}*** for delivery to id ${partner[postData.id]}`)
  webrtcResponse(`Saving message ***${postData.message}*** for delivery to id ${partner[postData.id]}`, res)
}

// 排队发送 JSON 响应
function webrtcResponse(response, res) {
  log(`replying with webrtc response ${JSON.stringify(response)}`)
  res.writeHead(200, { 'Content-Type': 'application/json' })
  res.write(JSON.stringify(response))
  res.end()
}

// 发送错误作为 JSON WebRTC 响应
function webrtcError(err, res) {
  log(`replying with webrtc error: ${err}`)
  webrtcResponse({ err }, res)
}

// 返回所有排队获取 info.postData.id 的消息
function getMessages(info) {
  const postData = JSON.parse(info.postData)
  const res = info.res
  if (typeof postData === 'undefined') {
    webrtcError('No postted data in JSON format', res)
    return
  }
  if (typeof postData.id === 'undefined') {
    webrtcError('No id received on get', res)
    return
  }
  if (typeof messagesFor[postData.id] === 'undefined') {
    webrtcError(`Invalid id ${postData.id}`, res)
    return
  }
  log(`Sending message ***${JSON.stringify(messagesFor[postData.id])}*** to id ${postData.id}`)
  webrtcResponse({ msgs: messagesFor[postData.id] }, res)
  messagesFor[postData.id] = []
}

exports.connect = connect
exports.get = getMessages
exports.send = sendMessage
