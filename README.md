# BNGUClient

一个用于 RoboMaster 的电脑客户端：看机器人状态和图传画面，并把键盘、鼠标输入发给机器人。

本项目在 [JNU-SHARK/SharkClient](https://github.com/JNU-SHARK/SharkClient) 的基础上整理和修改。这是 **afterrain2006/BNGUClient**，不是原作者的仓库。

## 第一次来，先看这里

**不会编程也没关系，请从 [安装与使用：一步一步跑起来](docs/installation-and-usage.md) 开始。** 里面写了软件下载地址、终端怎么打开、每个输入框填什么，以及成功后应该看到什么。

目前这个仓库没有发布现成安装包；下面按“下载代码后在自己电脑上运行”说明。你不需要安装 Python、CUDA、TensorRT，也不需要下载 AI 模型。

| 你想做什么 | 看哪份说明 |
| --- | --- |
| 第一次安装，在没有机器人的情况下先试一试 | [安装与使用指南](docs/installation-and-usage.md) |
| 连不上、没画面、按键没有反应 | [遇到问题怎么办](docs/debugging.md) |
| 找配置文件、查某个功能的代码在哪 | [文件夹和文件导航](docs/project-map.md) |
| 准备连接真实机器人 | [上机前检查清单](docs/development-handoff.md) |
| 想了解数据怎么收到、怎么显示、怎么发出去 | [程序怎样工作](docs/telemetry-architecture.md) |

## 已经装好工具？这样启动

打开项目文件夹里的 PowerShell。确认当前文件夹能看到 `package.json`、`src` 和 `src-tauri`，然后逐行执行：

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run tauri -- dev
```

第一次会下载东西和编译程序，请等桌面窗口打开，不要提前关闭终端。只运行 `npm run dev` 打开的是网页，不是带机器人通信功能的完整客户端。

没有机器人时，在**第二个终端**里回到同一个项目文件夹，执行：

```powershell
npm.cmd ci --prefix tools/rm2026-mock-server
npm.cmd run dev --prefix tools/rm2026-mock-server
```

这个工具只在本机假扮机器人，并发送循环测试画面。客户端按 **Esc → 操作中心 → 连接配置**，在“网络”页填写：

| 界面上的名字 | 本机测试填写什么 |
| --- | --- |
| IP 地址 | `127.0.0.1`，意思是这台电脑自己 |
| MQTT 端口 | `3333` |
| Client ID | `3`，不要填电脑名称 |
| 用户名 | 留空 |
| UDP 监听端口 | `3334` |
| 编码类型 | 自动检测 |

先点 **Broker 地址旁边的“连接”**。再到“机器人”页选择 **红方3号步兵**，到“视频源”页选择 **UDP**，最后点底部 **“应用并连接”**。

成功后能看到循环测试画面和变化的数据。返回视野，点击 **“启用键鼠控制”** 才开始发送按键。详细步骤和每一步的检查方法见 [本机测试教程](docs/installation-and-usage.md#5-没有机器人也能测试)。

## 使用时记住这几件事

- **Esc** 打开菜单。开菜单时视频和数据继续接收，但键鼠控制会停止；回来后要手动重新启用。
- **F10** 收起两侧状态面板；**F11** 切换全屏。如果 F11 没反应，去“系统设置”打开相应开关。
- 想调整面板位置，用“HUD 工作台”。HUD 就是叠在视频上的血条、小地图等面板。
- “Client ID”决定本次连接对应哪台机器人；“机器人”下拉框只决定你看谁的数据。两个不是同一个设置。
- “遥测”就是机器人发来的状态数据。没收到的字段显示 `—`，不是自动填成 0。
- 本机测试服务不发送模块状态，所以模块灯灰色是正常的。

## 现在能用什么，还不能用什么

能做的：接收当前已接入的 RM2026 机器人和比赛状态、显示 UDP 图传、发送键鼠输入、调整界面面板、查看原始自定义字节，以及导出当前状态文件。

还不能当成完成的功能：电控自定义字节的业务解析、自定义图片拼接、K 键菜单里的部分操作。看见原始字节不等于已经能显示其中的图片或状态。地图位置也需要现场校准。

按键到了客户端或测试服务，不代表真实机器人一定执行正确。机器人端仍要处理通信中断后的停止保护；本地测试通过不等于赛场验收通过。

## 文件夹现在怎么分

```text
BNGUClient/
├─ rules/          赛事协议；目前的 RM2026 在这里
├─ core/           大家共用的数据格式和状态定义
├─ src/            客户端页面、通信和状态处理代码
├─ src-tauri/      负责电脑窗口、收发数据、视频解码的 Rust 代码
├─ resources/      机器人配置、地图、面板模板
├─ public/         网页直接用的图片等资源
├─ tools/          本机测试服务、状态灯预览
├─ tests/          自动检查程序是否改坏
├─ scripts/        构建和检查用的小脚本
└─ docs/           安装、使用和排错说明
```

找界面去 `src/pages` 和 `src/ui`；找通信去 `src/communication`；找收到的数据去 `src/state/telemetry`。更详细的路径和旧文件去向见 [目录导航](docs/project-map.md)。

## 想生成 exe 或更新代码

Windows 在项目根目录运行 `npm.cmd run build:desktop`，完成后程序在 `src-tauri/target/release/BNGUClient.exe`。`npm run build` **只生成网页文件，不生成 exe**。

不要只把 exe 拷到另一台电脑就认为能用了，还要确认程序需要的资源文件和运行环境。安装包、Linux 启动和安全更新步骤见 [安装指南](docs/installation-and-usage.md)。

## 来源与许可证

参考原项目是 [JNU-SHARK/SharkClient](https://github.com/JNU-SHARK/SharkClient)，保留其作者贡献与代码历史。项目许可证为 [GPL-3.0](LICENSE)，第三方代码保留各自的许可证。

GitHub 文件列表右边相同的文字是“最后一次修改它的提交说明”，不是文件内容重复。文件用途请看目录导航。
