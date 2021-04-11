const http = require('http')
const url = require('url')
const fs = require('fs')
const log = require('./log').log

/**
 * 设置静态文件（HTML、JS 等）的路径
 */
let serveFilePath = ''
function setServeFilePath(p) {
  serveFilePath = p
}
exports.serveFilePath = setServeFilePath

/**
 * 先从给定路径名称中删除 ... 、 ～ 和其他从安全角度而言存在问题的语法位，再向其开头添加 serveFilePath
 */
function createFilePath(pathname) {
  const components = pathname.substr(1).split('/')
  const filtered = new Array()
  let temp
  for (let i = 0, len = components.length; i< len; i++) {
    temp = components[i]
    if (temp === '..') continue // 没有上级目录
    if (temp === '') continue // 没有根目录
    temp = temp.replace(/~/g, '') // 没有用户目录
    filtered.push(temp)
  }
  return (serveFilePath + '/' + filtered.join('/'))
}

/**
 * 确定所提取的文件的内容类型
 */
function contentType(filepath) {
  const index = filepath.lastIndexOf('.')
  if (index >= 0) {
    switch (filepath.substr(index + 1)) {
      case 'html': return 'text/html'
      case 'js': return 'application/javascript'
      case 'css': return 'text/css'
      case 'txt': return 'text/plain'
      default: return 'text/html'
    }
  }
  return 'text/html'
}

/**
 * 如果没有为请求定义处理程序，返回 404
 */
function noHandlerErr(pathname, res) {
  log('No Request handler found for ' + pathname)
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.write('404 Not Found')
  res.end()
}

/**
 * 确认非文件的处理程序，然后执行该程序
 */
function handleCustom(handle, pathname, info) {
  if (typeof handle[pathname] === 'function') {
    handle[pathname](info)
  } else {
    noHandlerErr(pathname, info.res)
  }
}

/**
 * 打开指定文件、读取其中的内容并将这些内容发送至客户端
 */
function serveFile(filepath, info) {
  const res = info.res
  log('serving file ' + filepath)
  fs.open(filepath, 'r', function(err, fd) {
    if (err) {
      log(err.message)
      noHandlerErr(filepath, res)
      return
    }
    let readBuffer = Buffer.from({ length: 20480 })
    fs.read(fd, readBuffer, 0, 20480, 0, function(err, readBytes) {
      if (err) {
        log(err.message)
        fs.close(fd)
        noHandlerErr(filepath, res)
        return
      }
      log('just read ' + readBytes + ' bytes')
      if (readBytes > 0) {
        res.writeHead(200, { 'Content-Type': contentType(filepath) })
        res.write(readBuffer.toString('utf-8', 0, readBytes))
        res.end()
      }
    })

  })
}


/**
 * 确定请求的路径是静态文件路径，还是拥有自己的处理程序的自定义路径
 */
function route(handle, pathname, info) {
  log('About to route a request for ' + pathname)
  // 检查前导斜杠后的路径是否为可处理的现有文件
  const filepath = createFilePath(pathname)
  log('Attempting to locate ' + filepath)
  fs.stat(filepath, function(err, stats) {
    if (!err && stats.isFile()) {
      serveFile(filepath, info)
    } else {
      handleCustom(handle, pathname, info)
    }
  })
}

/**
 * 创建一个处理程序，以基于路径名称来路由请求
 */
let info = null
function start(handle, port) {
  function onRequest(req, res) {
    const urldata = url.parse(req.url, true)
    const pathname = urldata.pathname
    info = { res }
    log('request for ' + pathname + ' received')
    route(handle, pathname, info)
  }
  http.createServer(onRequest).listen(port)
  log('Server started on port ' + port)
}

exports.start = start
