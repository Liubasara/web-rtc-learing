/**
 * 创建客户端命令，用于建立基于 XML HTTP 请求的 WebRTC 信令通道
 *
 * 此信令通道假定通过共享密钥建立双人连接
 * 每次连接尝试都会导致状态在 waiting 和 connected 之间切换
 * 这意味着如果连接已建立，而两一个浏览器尝试进行连接，将断开现有连接
 * 并且新浏览器的状态将会变成 waiting
 */
const createSignalingChannel = function (key, handlers) {
  let id
  let status
  const doNothing = function (...args) {
    console.log(args)
  }
  const initHandler = function (h) {
    return (typeof h === 'function' && h) || doNothing
  }
  const waitingHandler = initHandler(handlers.onWaiting)
  const connectedHandler = initHandler(handlers.onConnected)
  const messageHandler = initHandler(handlers.onMessage)

  // 与信令服务器建立连接
  function connect(failureCB) {
    failureCB = typeof failureCB === 'function' ? failureCB : function () {}
    // 处理连接响应，该响应应为错误或状态 connected 和 waiting
    function handler() {
      if (this.readyState === this.DONE) {
        if (this.status === 200 && this.response !== null) {
          const res = JSON.parse(this.response)
          if (res.err) {
            failureCB(`error: ${res.err}`)
            return
          }
          // 如果没有错误，则保存状态和服务器生成的 ID，然后启动异步消息轮询
          id = res.id
          status = res.status
          poll()
          // 运行用户提供的处理程序来处理 waiting 和 connected 状态
          if (status === 'waiting') {
            waitingHandler()
          } else {
            connectedHandler()
          }
          return
        } else {
          failureCB(`HTTP error: ${this.status}`)
          return
        }
      }
    }
    // 打开 XHR 并发送包含密钥的连接请求
    const client = new XMLHttpRequest()
    client.onreadystatechange = handler
    // 请求 connect 接口
    client.open('GET', `/connect?key=${key}`)
    client.send()
  }

  /**
   * poll 会在访问访问服务器之前等待 n 毫秒
   * 对于前 10 次尝试，n 为 10 毫秒；对于接下来的 10 次尝试，n 为 100 毫秒；对于后续尝试，n 为 1000 毫秒
   * 如果收到实际消息，则将 n 重置为 10 毫秒
   */
  function poll() {
    let msgs
    const pollWaitDelay = (function () {
      let delay = 10
      let counter = 1
      function reset() {
        delay = 10
        counter = 1
      }
      function increase() {
        counter += 1
        if (counter > 20) {
          delay = 1000
        } else if (counter > 10) {
          delay = 100
        }
      }
      function value() {
        return delay
      }
      return { reset, increase, value }
    })()
  }

  function get(getResponseHandler) {
    // 响应应为错误或 JSON 对象
    // 只有当是后者的时候才将其发送给用户提供的 getResponseHandler 回调函数
    function handler() {
      if (this.readyState === this.DONE) {
        if (this.status === 200 && this.response !== null) {
          const res = JSON.parse(this.response)
          if (res.err) {
            getResponseHandler(`error: ${res.err}`)
            return
          }
          getResponseHandler(res)
          return res
        } else {
          getResponseHandler(`HTTP error: ${this.status}`)
          return
        }
      }
    }
    // 打开 XHR 并针对 ID 请求消息
    const client = new XMLHttpRequest()
    client.onreadystatechange = handler
    client.open('POST', '/get')
    client.send(JSON.stringify({ id }))
  }

  // 将传入的消息放入下一个事件循环进行异步处理
  function handleMessage(msg) {
    setTimeout(function () {
      messageHandler(msg)
    }, 0)
  }

  // 定义一个立即执行的函数 getLoop，从服务器检索消息，然后将自身计划为在 pollWaitDelay.value() 毫秒后重新运行
  ;(function getLoop() {
    get(function (response) {
      let i
      const msgs = (response && response.msgs) || []
      // 如果存在消息属性，则表示已经建立连接
      if (response.msgs && status !== 'connected') {
        // 将状态切换为 connected，确认建立连接
        status = 'connected'
        connectedHandler()
      }
      if (msgs.length > 0) {
        pollWaitDelay.reset()
        for (i = 0; i < msgs.length; i++) {
          handleMessage(msgs[i])
        }
      } else {
        pollWaitDelay.increase()
      }
      // 设置计时器以便重新检查
      setTimeout(getLoop, pollWaitDelay.value())
    })
  })()

  // 通过信令通道向另一端浏览器发送消息
  function send(msg, responseHandler) {
    responseHandler = responseHandler || function () {}
    // 分析响应并发送给处理程序
    function handler() {
      if (this.readyState === this.DONE) {
        if (this.status === 200 && this.response !== null) {
          const res = JSON.parse(this.response)
          if (res.err) {
            responseHandler(`error: ${res.err}`)
            return
          }
          responseHandler(res)
          return
        } else {
          responseHandler(`HTTP error: ${this.status}`)
          return
        }
      }
    }
    // 打开 XHR 并以 JSON 字符串的形式发送 ID 和消息
    const client = new XMLHttpRequest()
    client.onreadystatechange = handler
    client.open('POST', '/send')
    const sendData = { id: id, message: msg }
    client.send(JSON.stringify(sendData))
  }

  return {
    connect,
    send
  }
}
