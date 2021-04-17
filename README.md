本书代码源于 《WebRTC 权威指南》

```shell
# 执行命令
pm2 start npm --watch --name fakewebrtc -- run start
# curl post 请求方法示例
curl --silent --request POST --header 'Content-Type: application/json' --data "{id: 1}" -k http://127.0.0.1:5001/connect
```