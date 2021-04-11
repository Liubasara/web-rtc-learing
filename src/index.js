const server = require('./server')
const log = require('./log').log
const port = process.argv[2] || 5001

// 返回 404
function fourohfour(info) {
  const res = info.res
  log('Request handler fourohfour was called.')
  res.writeHead(404, { 'Content-Type': 'text/plain' })
  res.write('404 Not Found')
  res.end()
}

const handle = {}
handle['/'] = fourohfour

server.serveFilePath('static')
server.start(handle, port)
