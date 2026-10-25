# 安装与使用：一步一步跑起来

先在自己电脑上看到程序窗口，再用本机测试服务看到画面和数据，最后才连接真实机器人。第一次使用不需要改代码，不需要 Python 或 AI 环境。

本页主要按普通 Windows 10/11 的 64 位 Intel/AMD 电脑说明；Linux 在最后单独说明。ARM 电脑不要照抄 x64 下载选项，当前没有它的完整使用验证。

## 1. 先认识两个词，避免走错路

- **项目根目录**：下载下来的 `BNGUClient` 文件夹，里面能同时看到 `package.json`、`src`、`src-tauri`、`rules`。不是 `src` 文件夹里面。
- **终端**：输入命令的窗口。Windows 可以用 PowerShell；本文的 Windows 命令在 PowerShell 里执行，不是在浏览器地址栏里执行。

复制命令时只复制代码框里的内容，一行一行执行。不要把教程里的 `PS C:\...>` 提示文字也复制进去。看到错误先停在该步骤，不要继续粘贴后面的命令。

本文 Windows 命令使用 `npm.cmd`，它和通常见到的 `npm` 做同一件事，但能避开部分电脑上 PowerShell 不允许运行 npm.ps1 的问题。Linux 用 `npm`，不带 `.cmd`。

## 2. Windows 先安装这些工具

以下工具只需要安装一次。安装时需要联网，部分工具会要求管理员确认；普通启动项目不需要一直以管理员身份运行。

| 工具 | 去哪里下载，怎么选 | 用来做什么 |
| --- | --- | --- |
| Git | [Git for Windows](https://git-scm.com/downloads/win)，普通电脑选 x64 安装器；大多数选项保持默认 | 下载和更新代码 |
| Node.js | [官方下载页](https://nodejs.org/en/download)，选择 **22.x**、Windows、x64、`.msi`；本项目本地使用 22.x 验证，不是要求你选网页上最大的版本号 | 运行项目命令；安装器会一起装 npm |
| Microsoft C++ Build Tools | [官方安装器入口](https://visualstudio.microsoft.com/visual-cpp-build-tools/)，打开后勾选 **“使用 C++ 的桌面开发 / Desktop development with C++”**，保留其中的 MSVC 和 Windows SDK | 编译桌面程序和视频解码代码 |
| WebView2 Runtime | [微软下载页](https://developer.microsoft.com/en-us/microsoft-edge/webview2/#download)，找 **Evergreen Bootstrapper** 并安装；如果已装会提示 | 显示客户端窗口内容 |
| Rust | [官方下载页](https://rust-lang.org/tools/install/)，Windows 下载并运行 rustup-init；前面的 C++ 工具装好后再装它，普通电脑使用默认 MSVC 工具链 | 编译电脑通信和视频部分 |

不确定 C++ 工具勾选项时，可对照 [Tauri 的 Windows 环境说明](https://v2.tauri.app/start/prerequisites/#windows)。不需要安装 Android Studio，也不需要安装 Python、CUDA、TensorRT 或 AI 模型。

装完后关闭旧终端再打开；如果使用 VS Code，完全退出再打开，让它识别新工具。按 Windows 键，搜索 **PowerShell** 并打开，逐行输入：

```powershell
git --version
node --version
npm.cmd --version
rustc --version
cargo --version
rustup show active-toolchain
```

成功时每条都有版本信息，最后一条通常包含 `x86_64-pc-windows-msvc`。如果提示“无法识别”，先重新打开终端；还不行就检查对应工具是否装成功。Rust 用错工具链时，按官方说明执行 `rustup default stable-msvc`。如果提示 Rust 太旧，可执行 `rustup update stable` 后重试，不要修改项目文件绕过错误。

## 3. 下载代码，打开正确文件夹

### 第一次下载

在刚打开的 PowerShell 逐行执行：

```powershell
Set-Location $env:USERPROFILE
git clone https://github.com/afterrain2006/BNGUClient.git
Set-Location .\BNGUClient
Get-Location
Test-Path .\package.json
```

这会把项目下载到你的个人文件夹，例如 `C:\Users\张三\BNGUClient`。`$env:USERPROFILE` 会自动换成你自己的位置，不需要把“张三”照抄进去。最后一条应显示 **True**。

如果 `git clone` 提示目标目录已经存在，不要删除它，也不要在里面再次下载。改为打开已有项目，先检查它是不是正确仓库。

### 已经有项目

在资源管理器打开你的项目文件夹，点击顶部地址栏，输入 `powershell` 并按回车。也可以在 PowerShell 使用实际路径，例如：

```powershell
Set-Location 'D:\projects\BNGUClient'
Test-Path .\package.json
git remote -v
```

`D:\projects\BNGUClient` 只是路径示例，电脑没有 D 盘就换成你自己的位置。`origin` 应指向 `afterrain2006/BNGUClient`。不要打开参考原项目 `JNU-SHARK/SharkClient` 或其他旧副本。

用 VS Code 时，选择 **文件 → 打开文件夹**，打开整个 `BNGUClient`，再选 **终端 → 新建终端**。不是只打开一个 `.vue` 文件。

## 4. 第一次启动真正的客户端

确认上一步 `Test-Path .\package.json` 为 True，逐行执行：

```powershell
npm.cmd ci
npm.cmd run check
npm.cmd run tauri -- dev
```

| 命令 | 正在做什么 | 什么时候进入下一步 |
| --- | --- | --- |
| `npm.cmd ci` | 下载项目需要的组件 | 回到可以输入命令的提示行，且没有以错误结束 |
| `npm.cmd run check` | 检查代码、自动测试和协议文件 | 检查通过且没有失败测试 |
| `npm.cmd run tauri -- dev` | 编译并打开桌面客户端 | 等桌面窗口出现；这个命令运行中不回到提示行是正常的 |

第一次编译会比较慢，中途显示 `Downloading` 或 `Compiling` 不代表卡死。出错时看第一条报错，见 [排错说明](debugging.md)。

窗口默认全屏。看到“等待图传接入”、数据为 `—` 或“未连接”，说明程序已打开，只是还没接数据。**不要关闭这个终端**，关闭会结束开发运行。也不要另开 `npm run dev`，那会和它抢用同一个网页端口。

只有浏览器页面、没有桌面窗口？通常是启动成了 `npm run dev`。停止它后用上面的 `npm.cmd run tauri -- dev`。

## 5. 没有机器人也能测试

下面的 Mock 是“本机测试服务”：让这台电脑假扮机器人，发送变化的数据和循环测试画面。不需要裁判系统或真实电控，也不验证真实机器人的动作。

### 5.1 再打开一个终端，启动测试服务

客户端的第一个终端保持运行。再开第二个 PowerShell，进入**同一个项目根目录**。按第 3 节第一次下载的位置，命令是：

```powershell
Set-Location "$env:USERPROFILE\BNGUClient"
npm.cmd ci --prefix tools/rm2026-mock-server
npm.cmd run dev --prefix tools/rm2026-mock-server
```

如果项目在其他位置，第一行换成实际路径。不要只复制后两行，却留在一个不相关的文件夹。

看到以下内容就说明服务已启动：

```text
Broker listening on 127.0.0.1:3333
UDP Video:
127.0.0.1:3334
```

随后会不断显示 `[STATS]`，那是正常的运行记录，不是报错。两个终端都保持开启。测试视频在 `tools/rm2026-mock-server/assets/test.h265`，仓库已附带；文件存在时不需要另装 FFmpeg。

### 5.2 客户端先连接状态数据

1. 点击客户端窗口，按 **Esc** 打开菜单。
2. 点击 **操作中心 → 连接配置**。会弹出标题为“图传设置”的窗口。
3. 点顶部的 **网络** 标签，按表格填写。窗口内容可以向下滚动。

| 界面上的名字 | 填写内容 | 注意 |
| --- | --- | --- |
| 机器人连接 → IP 地址 | `127.0.0.1` | 只填地址，不带 `mqtt://` |
| UDP 图传设置 → 监听端口 | `3334` | 这是视频端口，不是下面的数据端口 |
| 编码类型 | 自动检测 | 第一次不用改缓冲区大小 |
| 状态数据连接（MQTT） → MQTT 端口 | `3333` | 先填 IP，再填这里 |
| 状态数据连接（MQTT） → 服务器地址 | 应显示 `mqtt://127.0.0.1:3333` | 这是完整地址，和最上面的 IP 框格式不同；最后核对一次 |
| Client ID | `3` | 只填数字 3，不填随机字符串或 `003` |
| 用户名 | 留空 | 本机服务不要求用户名 |

程序的视频监听地址默认是 `0.0.0.0`，意思是从本机网卡接收；不需要在菜单中找一个框再填它，也不要把最上面的 IP 改成这个值。

4. 点击 **服务器地址右边的“连接”**，不是底部的“应用并连接”。如果已有旧连接，先点它旁边的“断开”，再按本表填写并连接。
5. 在“状态数据连接（MQTT）”区域确认状态变为 **已连接**，并且“已接收”条数持续增加。

MQTT 这里负责状态数据和控制消息；视频是另一条 UDP 通道。只有 MQTT 已连接，不代表视频已经连接。

### 5.3 选对显示机器人，再连接视频

1. 在同一个设置窗口点 **机器人** 标签。
2. 在 **机器人型号** 下拉框选择 **红方3号步兵**。这不是“性能模式”选项。
3. 点 **视频源** 标签，选择 **UDP**。
4. 点击窗口底部 **应用并连接**。
5. 等待循环测试画面出现。按 Esc 返回操作视野；如果先退出的是设置弹窗，再按一次 Esc 才会开操作菜单。

现在应能看到测试画面、当前血量和变化的数据。如果血量还是 `—`，先核对你选择的是红方3号步兵，而不是默认的红方1号英雄。

**两个机器人设置不要混淆：** `Client ID = 3` 决定这次连接的身份；下拉框选择红方3号步兵决定屏幕显示谁。只改下拉框不会替你修改 Client ID。

### 5.4 检查键鼠输入有没有发出去

1. 返回视频视野，点击底部 **启用键鼠控制**。
2. 按住 W 一小会儿再松开，或移动鼠标。不要连接实机做这一段测试。
3. 看第二个终端，应出现 `RX CONTROL` / `KeyboardMouseControl`。
4. 打开 `tools/rm2026-mock-server/metrics/runtime.json`，最近命令里按住 W 时应出现 `keyboardValue: 1`，松开后为 `0`。文件会自动更新，不要手动修改。
5. 再按住 W，按 Esc 打开菜单。菜单打开后应释放按键；关菜单后不会自动重新控制，要再次点“启用键鼠控制”。

点击第二个终端会让客户端失去焦点，控制也会暂停，这是预期行为。回到客户端需要重新启用。

### 5.5 什么算测试成功

- 能看到循环测试视频。
- 红方3号步兵的状态有数据，消息条数增加。
- 启用控制后，测试服务能收到按键；松开后键位回到 0。
- 打开菜单不会断开画面，但会停止操控。

**模块灯灰色不算失败。** 这个测试服务不发送 `RobotModuleStatus`（模块状态报告）。要单独看灯的各种状态，见 [状态灯预览说明](../tools/robot-state-preview/README.md)。

测试服务只在本机监听，不需要改静态 IP、打开路由器端口或关闭防火墙。端口被占用时，见 [端口占用处理](debugging.md#5-提示端口被占用了)。

### 5.6 关闭程序，下次再开

客户端按 **Esc → 系统设置 → 退出客户端 → 确定**。然后回到两个终端，分别按 **Ctrl+C** 停止命令。

下次不需要重新下载代码；进入项目根目录后，第一个终端运行 `npm.cmd run tauri -- dev`，第二个终端运行 `npm.cmd run dev --prefix tools/rm2026-mock-server`。连接参数要重新确认；不要假定所有输入框都会自动保存。

## 6. 平时怎么用菜单

| 你要做什么 | 点击或按什么 |
| --- | --- |
| 打开/关闭菜单 | Esc，或者右上角“菜单” |
| 设置 IP、数据端口和视频端口 | 操作中心 → 连接配置 → 网络 |
| 选择看哪台机器人的数据 | 连接配置 → 机器人 → 机器人型号 |
| 选择 UDP 视频来源 | 连接配置 → 视频源 |
| 看收到的数据、导出状态文件 | 菜单左侧“机器人状态” → 导出当前状态 |
| 看自定义原始字节 | 菜单左侧“自定义数据” |
| 调整血条、小地图等面板 | 面板编辑，完成后点“完成编辑” |
| 切回简洁面板 | 操作中心 → 使用紧凑面板 |
| 收起两侧状态面板 | F10，再按恢复 |
| 切换全屏 | F11；可在系统设置打开/关闭 |
| 打开内部排错窗口 | 系统设置打开“调试模式”，再按 F12 |
| 临时把鼠标还给桌面 | 已启用控制时按住 Backspace；松开可能恢复控制。想持续暂停，用 Esc 菜单 |

Ctrl+1/2/3/4 可直接打开操作中心/机器人状态/自定义数据/系统设置。输入框正在打字时不会执行这些跳转。

机器人状态导出的是当前状态 JSON 文件，通过系统下载功能保存；是否弹出保存位置由系统决定。不是录像，也不能靠它回放整场比赛。血量趋势最多记 120 个采样点，切换机器人或重新连接后清空。

## 7. 配置文件在哪里，改了为什么没生效

**只改连接地址时，用客户端设置窗口，不需要编辑下面的文件。** 以下是维护机器人列表、面板等内容时才需要的位置。

表里的路径从项目根目录算起。例如项目在 `D:\projects\BNGUClient`，`resources/RobotConfig.yaml` 就是 `D:\projects\BNGUClient\resources\RobotConfig.yaml`。用资源管理器打开，或用 VS Code 打开后修改。

| 文件或文件夹 | 里面是什么 | 什么时候需要改 |
| --- | --- | --- |
| `resources/RoboSelect.yaml` | 机器人下拉框里的名字列表 | 增减显示选项 |
| `resources/RobotConfig.yaml` | 名字对应的机器人 ID、类型，以及自定义数据格式文件的路径 | 和上面的名字列表一起调整 |
| `resources/HUDPanel/` | 血条、小地图等面板模板 | 调整自定义面板；优先用工作台操作 |
| `resources/DashboardConfig/` | 保存的面板位置、大小等布局 XML | 在“视频源 → 界面配置”中保存/选择 |
| `resources/CustomElement/` | 绘图和装饰模板 | 调整绘图模板 |
| `resources/CustomByteBlockConfigs/` | 电控自定义数据的样例文件 | 最终协议确定后再由开发者修改，目前解析未完成 |
| `resources/MessageMQTTConfig.yaml` | 消息显示的配置 | 调整现有消息面板 |
| `rules/rm2026/proto/messages.proto` | RM2026 消息的正式格式定义 | 只有协议变更时才改，普通连接不用改 |
| `rules/rm2026/defaults.ts` | 新启动时使用的默认 MQTT 地址和订阅列表 | 开发者改默认值；临时连接直接改菜单 |

例如列表中的 `红方3号步兵`，在 `RoboSelect.yaml` 和 `RobotConfig.yaml` 中名字要完全一致，不能多空格。YAML 用空格缩进，不要用 Tab。不要把样例注释中的宽泛 ID 范围当成程序支持范围；当前连接只接受 1～11 或 101～111，具体用哪个编号按实际设备确认。

### “保存配置”不是保存网络参数

“视频源 → 界面配置 → 保存配置/另存为”保存的是面板位置、大小和显示设置，**不保存 MQTT 地址、Client ID 和 UDP 端口**。重开程序后先检查网络页，不能因为保存过布局就跳过连接设置。

### 源码和运行副本不要改混了

程序优先使用它找到的运行资源文件夹；如果 exe 旁边已有 `resources` 或旧打包方式的 `_up_/resources`，修改项目根目录的另一份可能不会生效。打包时也可能复制资源，源码和运行副本不保证是同一份。

开发者可在项目根目录用下面的命令找常见副本：

```powershell
Get-ChildItem -Path .\resources, .\src-tauri\target\debug -Filter RobotConfig.yaml -Recurse -ErrorAction SilentlyContinue | Select-Object FullName
```

修改前先备份文件。确认正在运行哪一份程序后，再改它实际使用的资源。改完关闭客户端并重新启动；不要依赖“重新加载界面”按钮，该按钮当前未完成，也不要假定每个 XML/YAML 都会立即刷新。

### 临时设置放在哪里

默认在 **exe 所在文件夹的 `Cache`** 中。例如：

- 开发运行或调试构建：`src-tauri/target/debug/Cache/`。
- 正式构建：`src-tauri/target/release/Cache/`。
- `Cache/settings.json`：通过桌面设置接口保存的内容，不是全部设置的总表。
- `Cache/WebView/`：界面保存的快捷键、调试开关、HUD 呈现偏好等；不要手工编辑里面的数据库。

开发版和正式版的 exe 不同，可能使用不同的 Cache。设置过 `BNGUCLIENT_CACHE_DIR` 时以该位置为准。排错时先备份并找准具体设置，**不要上来就删除整个 Cache 或项目文件夹**。

## 8. 改成连接真实机器人

先确认数据由哪台电脑提供。我们已经调通的方式是：本机启动官方选手端和配套后台，自定义客户端连接本机接口。另一台电脑运行赛事引擎，不代表这里要填赛事引擎的 IP。

### 官方选手端和自定义客户端在同一台电脑

1. 停止本机测试服务，避免与官方程序抢用端口。
2. 用官方包根目录的 `Start.bat` 启动官方选手端，接好图传接收端 USB，确认官方程序能看到机器人和画面。
3. 自定义客户端按 Esc → 操作中心 → 连接配置 → 网络，保留 IP `127.0.0.1`、MQTT 端口 `3333`、UDP 监听端口 `3334`。
4. 机器人编号（Client ID）填实际编号。我们联调时红方3号填 `3`，用户名留空。
5. 点击服务器地址旁的“连接”，检查已接收消息数是否增加。
6. 在“机器人”页选对应的显示对象，在“视频源”页选 UDP，再点“应用并连接”。

`127.0.0.1` 表示这台电脑自己，是 IP 地址，不是端口号。当前程序的视频接收服务监听本机网卡，并按 IP 输入框筛选视频来源。

### 服务在另一台电脑或使用赛场提供的接口

把 IP 改成对方实际提供服务的地址，同时确认 MQTT 端口和机器人编号。视频发送端应把视频发到**运行自定义客户端这台电脑的网卡 IP**，目标端口与客户端的 UDP 监听端口一致。

官方通信协议 V1.3.0 正文列出的地址是服务器 `192.168.12.1:3333`、自定义客户端 `192.168.12.2`；附录示例代码默认 IP 为 `127.0.0.1`。本项目默认采用实际调通的本机连接方式，现场地址按现场要求填写。

当前 IP 输入框同时影响 MQTT 地址和视频来源筛选。如果两者来自不同电脑，需要分别核对设置，不能只改一个 IP 就认为全部接好了。

详细接线、驱动、官方程序启动和故障处理见 [连接官方选手端](official-client-connection.md)。操控测试步骤见 [上机前检查](development-handoff.md)。

## 9. 更新代码、生成 exe 和安装包

### 更新已有项目

先关闭正在运行的客户端和开发命令。在项目根目录：

```powershell
git status
git remote -v
```

确认 `origin` 是 `afterrain2006/BNGUClient`。如果 `git status` 显示本地改动，先备份或提交自己的修改，不要继续更新来覆盖它。如果没有本地改动，再执行：

```powershell
git pull --ff-only origin main
npm.cmd ci
npm.cmd run check
npm.cmd run tauri -- dev
```

如果 Git 提示不能快进或存在冲突，停下来处理，不要使用 `git reset --hard`。更新源码不会改变已经编译好的旧 exe；要么重新用开发命令启动，要么重新构建。

### 生成能独立打开的程序

项目根目录执行：

```powershell
npm.cmd run check
npm.cmd run build:desktop
```

成功后 Windows 程序在 **`src-tauri/target/release/BNGUClient.exe`**。可以从项目根目录运行：

```powershell
& .\src-tauri\target\release\BNGUClient.exe
```

调试版命令是 `npm.cmd run tauri -- build --debug --no-bundle`，输出在 `src-tauri/target/debug/BNGUClient.exe`。不要把 debug 和 release 两份旧新程序弄混。

这些构建会把网页内容放进程序，不需要再启动 Vite；但不等于只复制 exe 就能发给任何人。程序仍需要正确的运行环境和资源文件。

需要 Windows 安装包时执行 `npm.cmd run build:installer`，安装器输出目录为 `src-tauri/target/release/bundle/nsis/`。生成安装包不代表已在干净电脑测试通过。`npm.cmd run build` 只输出 `dist` 网页文件，不产生 exe。

## 10. Linux 用户

下面按有图形桌面的 Ubuntu/Debian 系说明；在 Linux 终端执行，不要在 Windows PowerShell 执行。其他发行版看 [Tauri 官方系统依赖说明](https://v2.tauri.app/start/prerequisites/#linux)。

先装 Git、Node.js 22.x、npm 和 stable Rust。Node/Rust 从第 2 节的官方入口按 Linux 指引安装；再装桌面编译依赖：

```bash
sudo apt-get update
sudo apt-get install -y git build-essential pkg-config \
  libwebkit2gtk-4.1-dev libgtk-3-dev libsoup-3.0-dev \
  libjavascriptcoregtk-4.1-dev librsvg2-dev patchelf
```

进入你要保存代码的文件夹，再执行：

```bash
git clone https://github.com/afterrain2006/BNGUClient.git
cd BNGUClient
npm ci
npm run check
npm run tauri -- dev
```

第二个终端进入同一个 `BNGUClient` 文件夹，运行 `npm ci --prefix tools/rm2026-mock-server` 和 `npm run dev --prefix tools/rm2026-mock-server`。界面参数按第 5 节填写。

构建用 `npm run build:desktop`，输出为 `src-tauri/target/release/BNGUClient`。Linux 安装包可用 `npm run tauri -- build --bundles deb,appimage`，输出在同级 `bundle` 文件夹下。

不要把 Windows 的 `node_modules` 或 `target` 复制给 Linux。只有命令行、没有桌面的 SSH/容器不能用来证明客户端窗口和视频可用；不同 Linux 驱动组合仍需实际测试。
