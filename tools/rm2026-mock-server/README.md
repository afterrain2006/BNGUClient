# RM2026 Mock Server

用于 BNGUClient 原生开发的本地 RoboMaster 2026 基线服务。它与客户端源码解耦，只提供本地 MQTT Broker、真实仓库 Protobuf 消息和 RM2026 UDP H.265 分片流。

## 功能

- MQTT Broker：`127.0.0.1:3333`
- 动态 `infantry-demo` 场景
- 监听并解码客户端上行控制消息
- FFmpeg `testsrc2` 生成的无版权 1280×720、30 FPS 动态 HEVC 测试图
- Annex-B access unit 解析和 8 字节 RM2026 UDP 分片头
- 可选丢包、抖动和乱序模拟
- `metrics/runtime.json` 运行指标

Mock 直接加载仓库的 `UDP-MQTT Server/proto/messages.proto`，不会维护第二套手写协议。

## 安装与启动

```powershell
cd tools/rm2026-mock-server
npm ci
npm run dev
```

仓库附带 `assets/test.h265` 测试图码流；缺失时启动脚本会调用本机 FFmpeg 生成。也可以在安装 FFmpeg 后手动重新生成：

```powershell
npm run generate-video
```

## 连接 BNGUClient

1. 启动 Mock Server。
2. 图传页按 P 打开 Dashboard 设置，在“机器人连接”把 IP 地址设为 `127.0.0.1`（不要填 mqtt:// 前缀），MQTT 端口设为 `3333`，Client ID 设为 `3`，点击连接。
3. UDP 地址保持 `0.0.0.0:3334`，视频编码可选择“自动检测”或“H.265”，点击连接。
4. 手动选择红方 3 号步兵查看数据。连接的 Client ID 决定本机身份；`RobotStaticStatus` 只校验身份、更新静态信息，不改变 UI 选择。

比赛默认地址 `mqtt://192.168.12.1:3333` 没有被修改。

## 当前模拟消息

| Topic | 频率 |
|---|---:|
| `GameStatus` | 10 Hz |
| `RobotStaticStatus` | 1 Hz |
| `RobotDynamicStatus` | 10 Hz |
| `RobotPosition` | 20 Hz |
| `Buff` | 5 Hz |
| `Event` | 2 Hz |

任务描述中的旧名称 `RobotStatus`、`ProjectileAllowance`、`RobotBuff`、`EventData` 在当前协议中分别由 `RobotStaticStatus`/`RobotDynamicStatus`、`remaining_ammo`、`Buff`、`Event` 表达。

## 视频与分片

- 来源：FFmpeg 动态 `testsrc2`，无第三方素材；本机 FFmpeg 缺少 fontconfig，因此未叠加文字时间戳
- 编码：HEVC Annex-B、GOP 30、无 B-frame、repeat headers、AUD
- 发送单位：完整 access unit，一张编码图像对应一个 `frame_number`
- UDP fragment payload：默认 1200 字节
- Header：`frame_number u16 BE`、`fragment_index u16 BE`、`total_frame_size u32 BE`

## 网络异常模拟

默认全部关闭：

```powershell
npm run dev -- --packet-loss 0.01 --jitter 10 --reorder 0.01
```

- `--packet-loss`、`--reorder` 范围为 0～1。
- `--jitter` 单位为毫秒。
- `--fragment-size` 可在 256～1400 之间调整。

## 测试

```powershell
npm test
npm run typecheck
```

覆盖仓库 Proto 编解码、Broker publish/subscribe、UDP 大端分片重组和 H.265 access unit 解析。

## 已知限制

- 仅实现第一批 6 种下行消息，不模拟全部 RM2026 协议。
- 不发送 RobotModuleStatus；模块灯等待/灰色是预期行为。完整灯态可用 [状态预览](../robot-state-preview/README.md) 验证。
- 视频是循环的 10 秒测试码流。
- 网络异常模拟是轻量实现，不是精确的网络仿真器。
- Mock 只绑定 loopback，不提供认证，不应暴露到比赛或公共网络。
