# 机器人状态组件预览

这是单独查看血条和模块灯的测试页，不需要真实机器人，不会连接 MQTT。第一次安装客户端见 [安装教程](../../docs/installation-and-usage.md)。

先结束桌面开发命令（回到启动终端按 Ctrl+C），避免重复占用 1420 端口。在项目根目录 PowerShell 执行：

```powershell
npm.cmd run dev
```

终端保持运行，在浏览器打开 [状态预览](http://localhost:1420/tools/robot-state-preview/)。

也可以打开指定场景：

[正常场景](http://localhost:1420/tools/robot-state-preview/?scenario=live)

| 地址最后的 scenario 值 | 看什么 |
| --- | --- |
| missing | 还没有收到数据 |
| live | 正常收到报告 |
| zero | 血量真的为 0，不应该显示成未收到 |
| timeout | 原来的报告已经过期 |
| disconnected | 连接断开 |
| reconnected | 刚重连，还在等新报告 |
| recovered | 重连后已经收到新报告 |

看蓝方的例子：[蓝方恢复场景](http://localhost:1420/tools/robot-state-preview/?clientId=103&scenario=recovered)。

它使用实际血条/模块灯组件和实际规则解释模拟消息，但只验证显示效果，不验证网络、视频或真实机器人。测试完成后，回终端按 Ctrl+C；要运行完整客户端，再用 `npm.cmd run tauri -- dev`。
