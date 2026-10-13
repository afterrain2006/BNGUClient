# 本机测试服务：不接机器人也能先试客户端

Mock 的意思是“模拟”。这个工具在你的电脑上假扮一台红方3号步兵，发送状态数据和循环视频，也会显示客户端发来的按键。

第一次安装工具和客户端，请先看 [完整安装指南](../../docs/installation-and-usage.md)。下面所有命令都在 **BNGUClient 项目根目录** 执行，不需要先进入工具的 src 文件夹。

## 1. 开两个终端

终端 A 启动客户端：

```powershell
npm.cmd run tauri -- dev
```

终端 B 回到同一个 BNGUClient 文件夹，第一次安装后启动测试服务：

```powershell
npm.cmd ci --prefix tools/rm2026-mock-server
npm.cmd run dev --prefix tools/rm2026-mock-server
```

`ci` 只在第一次或依赖变化后需要运行。之后可直接运行第二行。看到 `Broker listening on 127.0.0.1:3333` 就表示服务起来了；终端不断打印 `[STATS]` 是正常的，先别关闭。

## 2. 客户端这样填

客户端按 Esc → 操作中心 → 连接配置 → 网络。

| 输入框 | 填写内容 |
| --- | --- |
| IP 地址 | `127.0.0.1`，不带 mqtt:// |
| MQTT 端口 | `3333` |
| Broker 地址 | 核对为 `mqtt://127.0.0.1:3333` |
| Client ID | `3` |
| 用户名 | 留空 |
| UDP 监听端口 | `3334` |
| 编码类型 | 自动检测 |

先填 IP 和端口，最后核对完整 Broker 地址。先点 **Broker 地址旁的“连接”**，确认 MQTT 显示已连接、已接收数字增长。

然后点“机器人”标签，在“机器人型号”选择 **红方3号步兵**；点“视频源”标签选择 **UDP**，最后点底部 **应用并连接**。

Client ID 是连接身份，下拉框是显示对象，不会互相替你修改。视频监听地址保持程序默认的 0.0.0.0，不要拿它替换最上面的 127.0.0.1。

## 3. 怎么知道跑通了

- 客户端看到循环测试图，红方3号步兵有状态数据。
- 点击“启用键鼠控制”后，按 W 或移动鼠标，服务终端出现 `RX CONTROL` / `KeyboardMouseControl`。
- `tools/rm2026-mock-server/metrics/runtime.json` 记录最近命令；按住 W 时 `keyboardValue` 为 1，释放后为 0。
- 按 Esc 开菜单时控制释放，但视频继续；关菜单后要手动重新启用控制。

**模块灯灰色是正常的。** 本工具没有发送模块报告，不能用它全面验证模块灯。灯态可以用 [单独预览](../robot-state-preview/README.md) 检查。

关闭时客户端在系统设置中退出，两个终端分别 Ctrl+C。测试工具默认只在本机运行，没有认证，不要把它暴露到比赛或公共网络。

## 4. 端口被占用时

先关闭自己重复启动的那一份服务，或者在根目录改用：

```powershell
npm.cmd run dev --prefix tools/rm2026-mock-server -- --mqtt-port 1885 --udp-port 3336
```

客户端也要改成 MQTT 1885、UDP 3336，Broker 地址 `mqtt://127.0.0.1:1885`。IP 仍为 127.0.0.1，Client ID 仍为 3。不要只改一边。更多排错见 [问题处理](../../docs/debugging.md)。

## 5. 文件在哪里

| 路径，从项目根目录算起 | 内容 |
| --- | --- |
| `rules/rm2026/proto/messages.proto` | 和客户端共用的消息格式，只有这一份来源 |
| `tools/rm2026-mock-server/assets/test.h265` | 已附带的测试视频，循环播放 |
| `tools/rm2026-mock-server/src/config.ts` | 工具默认参数和可用启动选项 |
| `tools/rm2026-mock-server/src/scenarios/infantry-demo.ts` | 红方3号步兵演示数据 |
| `tools/rm2026-mock-server/metrics/runtime.json` | 运行时生成的统计，不手改、不上传 |

视频文件正常存在时不用装 FFmpeg。文件缺失或需要重新生成时，才需要让电脑能运行 `ffmpeg`，再执行：

```powershell
npm.cmd run generate-video --prefix tools/rm2026-mock-server
```

视频由工具生成，不使用赛事录像。它是测试图，不是机器人摄像头的画面。

## 6. 开发者说明

只发送以下六类数据，不模拟全部 RM2026 消息。下表是本工具的发送频率，**不是官方服务器承诺**。

| 消息名 | 每秒发送次数 |
| --- | ---: |
| GameStatus，比赛状态 | 10 |
| RobotStaticStatus，静态信息 | 1 |
| RobotDynamicStatus，动态状态 | 10 |
| RobotPosition，位置 | 20 |
| Buff，增益 | 5 |
| Event，事件 | 2 |

视频为 1280×720、30 FPS，循环约 10 秒。H.265 视频按完整编码帧分片，默认每片内容 1200 字节；8 字节头部依次为帧号 2 字节、片序号 2 字节、完整帧长度 4 字节，均为大端顺序。相关代码在项目根目录下的 `tools/rm2026-mock-server/src/video/`。

只在本机试丢包、延迟和乱序：

```powershell
npm.cmd run dev --prefix tools/rm2026-mock-server -- --packet-loss 0.01 --jitter 10 --reorder 0.01
```

`packet-loss` 和 `reorder` 是 0～1 的比例，`jitter` 单位毫秒。这是简单测试，不是精确网络仿真，不要在正式网络试。

根目录检查工具：

```powershell
npm.cmd test --prefix tools/rm2026-mock-server
npm.cmd run typecheck --prefix tools/rm2026-mock-server
```

本工具没有 `build` 命令，直接用上述检查和 dev 启动即可。
