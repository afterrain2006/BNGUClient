# 遇到问题怎么办

按你看到的现象找对应一节。先不要重装全部工具、删除项目、清空 Cache 或关闭防火墙。很多问题只是打开了另一份程序、输错了地址，或把视频连接和数据连接当成了一步。

文中的命令在**项目根目录的 PowerShell** 执行；不知道怎么打开，先看 [安装指南第 3 节](installation-and-usage.md#3-下载代码打开正确文件夹)。

## 1. 命令报错，程序还没打开

| 看到什么 | 先做什么 |
| --- | --- |
| 找不到 `package.json`、`ENOENT` | 运行 `Get-Location` 和 `Test-Path .\package.json`；后者必须是 True。进入 BNGUClient 根目录，不是 src |
| `npm.ps1` 无法加载、禁止运行脚本 | 把命令开头的 `npm` 改成 `npm.cmd`，不用永久放宽系统安全设置 |
| 无法识别 `git`、`node`、`cargo` | 关闭终端和 VS Code 后重新打开；还没有就补装对应工具 |
| `link.exe`、`windows.h`、C++ 编译器找不到 | 在 C++ Build Tools 安装器勾选“使用 C++ 的桌面开发”，包含 MSVC 和 Windows SDK |
| 提示 WebView2 缺失 | 安装 [微软 WebView2 Runtime](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download) |
| `npm ci` 下载失败、连接超时 | 检查网络，保存第一条错误；不要随机替换陌生下载源或跳过依赖 |
| `Compiling` 很久 | 第一次要编译桌面程序；这行本身不是报错。看是否还有新输出，不要因等待就连续再开几次 |
| 只有网页，没有桌面窗口 | 用 `npm.cmd run tauri -- dev`，不是 `npm run dev` |
| 找不到 `messages.proto` | 检查 `rules/rm2026/proto/messages.proto` 是否存在，确认下载的是完整的本仓库；不要删除启动检查脚本 |

工具安装步骤见 [安装指南](installation-and-usage.md)。发生错误后先处理这一条，不要继续执行后面的命令。

## 2. 程序打开了，但状态数据连不上

1. 本机测试时，确认第二个终端的测试服务还在运行，显示 `Broker listening on 127.0.0.1:3333`。
2. 客户端按 Esc → 操作中心 → 连接配置 → 网络。
3. IP 填 `127.0.0.1`，MQTT 端口填 `3333`，最后核对 Broker 地址是 `mqtt://127.0.0.1:3333`。
4. Client ID 填 `3`，用户名留空。不要把电脑名称填进 Client ID。
5. 点 **Broker 地址右边的“连接”**。底部“应用并连接”是视频操作，不会替你完成这一步。
6. 已有旧连接时先断开；修改 Client ID 输入框不等于当前连接身份已经改变。

可在 PowerShell 检查测试服务有没有接收连接：

```powershell
Test-NetConnection 127.0.0.1 -Port 3333
```

看 `TcpTestSucceeded` 是否为 True。False 表示先查服务和端口；True 只表示数据端口可达，**不能证明视频正常，也不能证明机器人数据已经正确收到**。

真实设备不能照填 127.0.0.1；请让网络负责人确认实际地址、端口和账号要求。当前设置页没有密码框，要求密码的服务器需要维护者另行确认配置方法。

## 3. 已连接，但血量还是横线或模块灯灰色

- 网络页的“已接收”是否在增加？不增加时先检查服务有没有发数据。
- 去“机器人”标签，把“机器人型号”选成 **红方3号步兵**。本机服务只发这台机器人的数据，默认红方1号英雄没有数据是正常的。
- Client ID 和显示机器人是两个设置。去“遥测”页下方的“已接收机器人”表确认收到的是哪个 ID。
- `—` 表示没收到；数字 `0` 是真实的零值，不代表连接失败。
- 灰色模块灯：本机测试服务根本不发送模块报告。用 [状态灯预览](../tools/robot-state-preview/README.md) 单独确认灯的显示。
- 数据过期或刚重连时，程序会等新消息，不会把旧值当作新报告。

看到 `StaticStatus … does not match` 一类提示，意思是收到的机器人编号和本次连接编号不一致。本机服务配 Client ID 3；不要靠切换显示机器人、硬改代码里的 ID 来掩盖不匹配。

## 4. 有数据但没视频，或有视频但按键不动

### 没视频

1. 本机服务终端应显示 `UDP Video: 127.0.0.1:3334`。
2. 客户端网络页：IP 为 `127.0.0.1`，UDP 监听端口为 `3334`，编码类型选自动检测。
3. 视频源页选择 UDP，再点底部 **应用并连接**。
4. 确认 `tools/rm2026-mock-server/assets/test.h265` 存在。正常下载的仓库已带测试文件，不需要先安装额外视频工具。
5. 看启动客户端的终端有没有 `UDP` 或解码错误，把第一条错误保存下来。

真实视频要由发送设备发往**你的客户端电脑**，而不是发往状态服务器。程序还会按设置的来源地址过滤视频；状态服务器和视频来源不同的场合，需要维护者核对设置。

### 按键没反应

1. 先连接本机测试服务，确认 MQTT 已连接。
2. 关闭菜单和编辑面板，点击 **启用键鼠控制**。
3. 按 W 后看测试服务终端是否收到 `KeyboardMouseControl`。
4. 如果点击了终端或切到其他软件，客户端会暂停控制；返回后重新启用。
5. 按 Esc 打开菜单后同样需要重新启用。按住 Backspace 只是临时释放，松开可能恢复。

测试服务收到 W，只证明客户端发送了“W 按下”。真实机器人如何移动由电控决定；客户端不替电控设置动作或速度。

## 5. 提示端口被占用了

端口可以理解为电脑上一个程序接收数据用的编号。一个编号已经被占住时，再开一份服务就可能失败。

| 编号 | 正常是谁使用 |
| --- | --- |
| TCP 1420 | 桌面开发命令自动启动的网页服务 |
| TCP 3333 | 本机测试服务的数据入口 |
| UDP 3334 | 客户端的视频接收入口 |

先回到自己开的终端，看看是不是重复启动了。已有 `tauri -- dev` 时不要另开 `npm run dev`；测试服务也只开一份。先用 Ctrl+C 结束**自己开的多余那份**，不要结束不认识的进程。

不知道谁占用时，只读检查：

```powershell
Get-NetTCPConnection -LocalPort 1420,3333 -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess
Get-NetUDPEndpoint -LocalPort 3334 -ErrorAction SilentlyContinue | Select-Object LocalPort,OwningProcess
```

没有输出一般表示没有查到占用。`OwningProcess` 是进程编号，可以在任务管理器“详细信息”中核对。不要复制一条命令去关闭全部 Node 或全部客户端进程。

想避开原端口，可在**项目根目录**启动另一组本机测试端口：

```powershell
npm.cmd run dev --prefix tools/rm2026-mock-server -- --mqtt-port 1885 --udp-port 3336
```

客户端同时把 MQTT 端口改成 **1885**、UDP 监听端口改成 **3336**，核对 Broker 地址为 `mqtt://127.0.0.1:1885`。只改一边不行。IP 和 Client ID 仍是 127.0.0.1、3。

## 6. 改了代码或配置，为什么还是老样子

先分清你改的是哪份代码、运行的是哪份程序：

- VS Code 用“文件 → 打开文件夹”打开正确的 BNGUClient 根目录。目录整理后，旧 Dashboard 文件在 `src/pages/Cockpit.vue`；旧标签关掉，从新目录重新打开。
- `npm.cmd run tauri -- dev` 使用当前源码；以前生成的 exe 不会跟着源代码自动改变。
- 修改源代码后仍双击旧 exe，就仍是旧程序。重新构建，确认打开的是 debug 还是 release。
- XML/YAML 可能有源码版和程序旁的运行副本，见 [配置路径说明](installation-and-usage.md#7-配置文件在哪里改了为什么没生效)。
- “视频源 → 界面配置 → 保存配置”保存面板布局，不保存 IP、Client ID、端口。
- 改完资源后重新启动程序；“重新加载界面”按钮当前没完成，不要依赖它。

项目根目录查看：

```powershell
Get-Location
git remote -v
git status
git log -1 --oneline
```

`origin` 应是 `afterrain2006/BNGUClient`。有本地修改时先备份，不要用 `git reset --hard` 强行刷新。

## 7. 怎么把有用的错误信息发给维护者

先截图第一条错误和前后几行，不要只截最后一句“退出码 1”。再附：

- Windows/Linux 版本；运行的是开发命令、debug exe 还是 release exe。
- 项目路径和启动命令。
- 是本机测试还是实机；填的 IP、端口、Client ID。
- 点了哪些按钮、预期出现什么、实际出现什么。
- `git log -1 --oneline` 的结果；涉及编译再附 Node、Rust 版本。

不要发密码、令牌、整份 Cache/WebView、完整电脑用户目录或几 GB 的 node_modules/target。真正没做过的实机测试要写“没测”，不要用本地成功代替。

## 8. 开发者再往下看：日志和断点

“断点”就是让程序在某行暂停，方便看那一刻收到了什么数据；普通使用不需要这一步。

客户端按 Esc → 系统设置，打开“调试模式”，返回视野按 F12 打开内部检查窗口。Console 看错误，Sources 找文件下断点。这个窗口不是普通浏览器的页面设置。

在 Console 只读查看实际连接：

```javascript
await window.api.mqtt.getStatus()
await window.api.udpStream.getStatus()
```

数据连接看 `connected`、`clientId`；视频看 `running` 和 `stats`。不要在 Console 随手发送实机控制命令。

更多桌面日志需要在启动前设置，项目根目录 PowerShell：

```powershell
$env:BNGUCLIENT_LOG = 'info,bnguclient_lib::udp_bridge=debug'
$env:RUST_BACKTRACE = '1'
npm.cmd run tauri -- dev
```

这里只影响当前终端。日志看启动终端，不会自动生成一整套 Cache/logs 文件。界面内日志只保留最近 200 条，不是永久记录。

| 要查哪一步 | 文件 |
| --- | --- |
| 桌面是否收到 MQTT 原始数据 | `src/communication/mqtt/mqttAdapter.ts` |
| 是否交给规则，是否分发到状态 | `src/communication/mqtt/mqttRuleRunner.ts` |
| 连接切换后是否停止旧消息处理 | `src/app/rm2026RuleLifecycle.ts` |
| RM2026 解码、编号和字段解释 | `rules/rm2026/` |
| 机器人状态有没有更新 | `src/state/telemetry/robotStore.ts` |
| 状态怎样整理给界面 | `src/telemetry/useTelemetryView.ts` |
| 按键是否合并、发送、释放 | `src/communication/control/controlSender.ts` |
| 视频收包、组帧、解码 | `src-tauri/src/udp_bridge.rs`、`src-tauri/src/video_decoder.rs` |

视频统计里的 `totalBytes` 是收包量，`assembledFrames` 是拼好的帧数，`decodedFrames` 是解码出的帧数。按这个顺序查，别因为画面黑就去修改 MQTT 规则。

## 9. 提交代码前的检查

全部在项目根目录 PowerShell 执行：

```powershell
npm.cmd run check
npm.cmd run build
npm.cmd run typecheck --prefix tools/rm2026-mock-server
npm.cmd test --prefix tools/rm2026-mock-server
cargo fmt --manifest-path src-tauri/Cargo.toml -- --check
cargo clippy --manifest-path src-tauri/Cargo.toml --all-targets -- -D warnings
cargo test --manifest-path src-tauri/Cargo.toml --no-fail-fast
git diff --check
```

`check` 包含类型检查、客户端测试和协议校验。`build` 只生成网页，不代表 Rust 程序或安装器构建成功。要测完整桌面构建，再运行 `npm.cmd run build:desktop`。

GitHub 页面点 **Actions**，选择对应提交，打开失败的任务，找第一条具体错误。旧提交的红叉不会因为新提交成功就消失，前端绿色也不等于其他任务全部通过。
