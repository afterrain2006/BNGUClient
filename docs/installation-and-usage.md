# 安装与使用指南

本文针对当前 BNGUClient 源码，不把参考仓库、历史打包脚本或 Mock 当成已验收的赛事客户端。排错与代码调试见 [调试指南](debugging.md)。

## 1. 先确定要运行什么

| 目的 | 命令（仓库根目录） | 能力 |
| --- | --- | --- |
| 只开发网页/UI | `npm run dev` | Vite 网页，无真实 Tauri MQTT/UDP 后端 |
| 查看血条和模块灯场景 | `npm run dev`，再打开下方预览地址 | 独立模拟状态，不连接 Broker |
| 运行桌面客户端 | `npm run tauri -- dev` | 启动 Vite、编译 Rust 并打开桌面窗口 |
| 生成前端静态文件 | `npm run build` | 生成 dist，不生成 exe/安装包 |
| 构建桌面发行程序 | `npm run tauri -- build --no-bundle` | 编译前端和 Rust，不生成安装器 |

首次只想看效果：完成 Windows 环境与依赖安装后，用桌面开发命令。没有真实机器人时再启动第 5 节的 Mock。客户端已移除 AI 检测，不需要 Python、模型或 AI 环境；内嵌 FFmpeg 也不是基础联调的前置条件。

## 2. Windows 环境安装

### 2.1 工具与用途

1. 从 [Git 官方下载页](https://git-scm.com/downloads/win) 安装 Git，安装后确认 `git --version` 能执行。
2. 从 [Node.js 官方下载页](https://nodejs.org/en/download) 选择 Node.js 22 分支安装（本地验证版本），包含 npm；不必额外安装全局 Vite/Tauri。
3. 安装 Microsoft C++ Build Tools，在安装器勾选“使用 C++ 的桌面开发”，包含 MSVC 编译器和 Windows SDK。
4. 确认安装 Microsoft Edge WebView2 Runtime；只有 Edge 浏览器本身不代表所有机器都具备所需运行时。
5. 按 [Rust 官方安装页](https://rust-lang.org/tools/install/) 安装 rustup，选择 MSVC 工具链。

C++ 工具、WebView2 和 MSVC Rust 的平台要求可核对 [Tauri 官方环境说明](https://v2.tauri.app/start/prerequisites/#windows)。本项目会编译 vendored libde265 C++ 源码，不能仅安装 Node.js。

安装后重新打开 PowerShell/VS Code 的终端，执行：

```powershell
git --version
node --version
npm --version
rustup show active-toolchain
rustc --version
cargo --version
```

Windows 工具链名称应包含 `pc-windows-msvc`。如果已有 Rust 太旧，使用 `rustup update stable`；如果选了 GNU 工具链，按 Tauri 说明切换为 `stable-msvc`。本次本地验证 Rust 1.98.0，不承诺更低版本全部兼容。

### 2.2 克隆与依赖

在准备放项目的父目录运行：

```powershell
git clone https://github.com/afterrain2006/BNGUClient.git
cd BNGUClient
npm ci
npm run check
```

`npm ci` 按 package-lock 安装依赖；`check` 依次做类型检查、客户端回归测试和协议引用校验。首次安装需要联网下载 npm/Cargo 依赖，首次 Rust 编译也会较慢。

已经有工作目录时不要再次在里面 clone；先用 `git status`、`git remote -v` 确认目录与本地改动，再决定是否更新。不要为了更新执行 `git reset --hard`。

当前源码不再包含 AI 源码发行包，不需要 Git LFS 或额外 Python 环境即可运行客户端。

### 2.3 启动真正的客户端

在仓库根目录运行：

```powershell
npm run tauri -- dev
```

等待终端完成 Rust 编译并打开桌面窗口。此命令自动启动 Vite，不要同时另开一个 `npm run dev` 占用 1420 端口。调试时保持终端开启；关闭程序可使用客户端退出功能，结束开发命令用 Ctrl+C。

窗口默认全屏；基础遥测没有连接时灰灯/等待数据不代表客户端启动失败。

## 3. Linux 环境

以 Ubuntu/Debian 系为例。需要 Git、Node.js/npm、stable Rust 与图形桌面环境。系统依赖与现有 CI 保持一致：

```bash
sudo apt-get update
sudo apt-get install -y build-essential pkg-config \
  libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev librsvg2-dev patchelf
git clone https://github.com/afterrain2006/BNGUClient.git
cd BNGUClient
npm ci
npm run check
npm run tauri -- dev
```

Node.js 与 Rust 的安装分别参考其官方安装页，发行版 apt 自带版本可能较旧。不要将 Windows 的 node_modules 或 target 直接复制给 Linux。无图形界面的 SSH/容器可做检查，但不能据此认定桌面窗口能显示。

其他发行版的平台依赖见 [Tauri Linux 说明](https://v2.tauri.app/start/prerequisites/#linux)。本指南不承诺所有发行版或 WSL 显示/视频驱动组合均已验收。

## 4. 客户端界面与基本操作

底部导航包含“图传”“遥测”“自定义数据”“设置”。注意有两处设置：底部“设置”页用于调试选项等全局功能；图传页按 P 打开 Dashboard 的连接、机器人与显示设置。

### 4.1 设置连接身份

1. 在图传页按 P 打开设置，进入连接区域。
2. “机器人连接 → IP 地址”填 MQTT 服务/图传源地址；这个输入框填 IP 或主机名，不填完整 `mqtt://...`。
3. MQTT 端口填实际端口，Client ID 填数字机器人 ID，如 `3` 或 `103`；用户名按服务端要求填写。
4. 点击 MQTT 连接，观察连接状态。仅发出连接请求不等于连接已建立。
5. 修改 IP/端口或 Client ID 后按提示断开并重新连接；修改输入框不会让旧连接自动变成新身份。
6. 在机器人选项中选择要查看的机器人。UI 选择不会改变本机 MQTT 身份，也不会把消息重定向到所选机器人。

本机身份来自连接的 Client ID。StaticStatus 用于校验并更新静态信息；若与连接身份不符，规则 warning 并忽略该静态更新，不静默切换身份。

### 4.2 默认界面快捷键

| 按键 | 作用 |
| --- | --- |
| P | 打开/关闭 Dashboard 设置菜单 |
| 按住 Backspace | 暂时退出键鼠捕获；松开后满足条件会恢复，不是持久暂停开关 |
| Esc | 退出 HUD 编辑（处于编辑模式时） |
| F7 | 准星设置 |
| F8 / H | 打开弹丸购买 / 远程补弹菜单，不等于请求已经执行 |
| +（Equal）/ - / Delete | 视频放大 / 缩小 / 恢复 |
| F11 | 全屏切换（需底部设置中的相应开关启用） |
| F12 | 打开 DevTools（需底部设置中启用调试模式） |

热键可被用户配置覆盖。连接建立且没有菜单/HUD 编辑时会进入捕获；浏览器可能需要用户点击后才允许指针锁定。没有锁定并不一定停止软捕获。

当前 RM2026 规则转发 W/S/A/D、Shift、Ctrl、Q/E/R/F/G/Z/X/C/V/B 和鼠标输入。这里仅定义输入编码，不决定机器人动作；K 键操作菜单中仍有占位项。

连接实机前先禁用执行机构或架空测试，确认松键、失焦和失联超时保护。中立帧可能丢失，不是安全停车保证。

## 5. 无硬件本地联调

### 5.1 两个终端分别启动

终端 A，仓库根目录：

```powershell
npm run tauri -- dev
```

终端 B，也从仓库根目录开始：

```powershell
cd tools/rm2026-mock-server
npm ci
npm run dev
```

Mock 的依赖独立安装；根目录 npm ci 不会安装工具子项目依赖。仓库附有 HEVC 测试码流；只有码流缺失或要重新生成时才需要系统 FFmpeg。

### 5.2 填入本地参数

| 参数 | 本地 Mock 设置 |
| --- | --- |
| Dashboard 的 IP 地址 | `127.0.0.1` |
| MQTT 端口 | `3333` |
| Client ID | `3` |
| 用户名 | 留空 |
| UDP 监听端口 | `3334` |
| UDP 编码 | 自动检测或 H.265 |
| UI 选择 | 红方 3 号步兵 |

程序默认 UDP 监听地址是 `0.0.0.0`，不是远程视频服务器地址。Dashboard 的统一 IP 还用于图传来源过滤，本地测试应设为 127.0.0.1。

先连接 MQTT，再在图传设置选择 UDP 并启动视频接收。预期看到变化的比赛/机器人数据与循环测试图。移动鼠标或按键时，Mock 终端会输出 `RX CONTROL`、`KeyboardMouseControl` 及解码字段；可在 Mock 的 `metrics/runtime.json` 查看最近控制和发送统计。

Mock 当前只发布六类遥测，**不发布 RobotModuleStatus**。因此看到变化的血量但模块灯等待/灰色是正常的，不能据此推断模块灯故障。需要全面验模块灯，用第 5.3 节。

不要用 Client ID 103 接当前红方 3 号场景再把不匹配 warning 当作程序损坏。不要同时启动内置 Broker 占用 Mock 的 3333 端口。Mock 默认仅绑定 loopback，无认证，不应暴露到公共网络。

### 5.3 专门验证血条与模块灯

停止桌面开发命令后，在根目录运行 npm run dev，浏览器打开：

```text
http://localhost:1420/tools/robot-state-preview/?scenario=live
http://localhost:1420/tools/robot-state-preview/?clientId=103&scenario=recovered
```

预览支持 missing、live、zero、timeout、disconnected、reconnected、recovered 七种场景，直接注入模拟协议消息，不连接 MQTT。它验证状态呈现，不验证真实网络或视频。

## 6. 切换到实际设备

1. 停止本地 Mock，不再使用 127.0.0.1 作为实机地址。
2. 连接对应网络，确认本机网卡配置与服务端要求；仓库预设的 MQTT 地址为 192.168.12.1:3333，但现场以实际配置为准。
3. 设置对应机器人 Client ID，重新连接；确认 UI 查看对象与预期一致。
4. 视频发送目标必须是这台客户端机器的可达地址与 UDP 3334，不能误填 Broker 的地址。
5. 验证血量/模块/位置、红蓝映射与断线重连；再按 [现场清单](development-handoff.md#现场联调清单) 测试操控和保护。

不要在本地联调阶段随意修改机器的静态网卡配置。跨机器测试需要改 Mock 的绑定/目标地址，按其参数说明操作；不要为了测试开放所有端口或关闭防火墙。

## 7. 构建、更新与可选功能

在根目录运行：

```powershell
npm run check
npm run tauri -- build --no-bundle
```

Windows 默认生成 `src-tauri/target/release/BNGUClient.exe`，Linux 为同目录下无 .exe 后缀的二进制。也可用 `npm run build:desktop` 执行不打包构建。无 bundle 的 exe 不等于自包含便携包，资源查找和依赖仍须核对，不要只复制一个 exe 就承诺可部署。

需要 Windows 安装器时，用 `npm run build:installer`；Linux 用 `npm run tauri -- build --bundles deb,appimage`。历史 lite/mini/single 和依赖 AI 的 Flatpak 打包脚本已移除。发布安装包前还应做干净机器验收。

产品名为 BNGUClient，应用标识为 `io.github.afterrain2006.bnguclient`。日志、缓存和视频配置使用 `BNGUCLIENT_` 环境变量，界面偏好使用 `bnguclient.` 设置键。旧应用偏好不会自动导入，旧缓存也不会自动删除；升级后重新确认连接参数和快捷键。

修改前端代码通常有 Vite 热更新；Rust 修改需要重新编译；资源 XML/YAML 不应假设每处都自动重读，必要时重新加载配置或重启。修改 MQTT proto 后运行 generate:mqtt-proto 和 verify:mqtt-proto，提交生成 JSON。

外部 FFmpeg 可用 `BNGUCLIENT_FFMPEG_PATH` 指定，internal-ffmpeg 是可选视频构建方式，与 AI 无关。电控自定义字节解析和图片重组尚未完成，详见 README“已知边界”，不能通过安装额外依赖让占位函数自动可用。
