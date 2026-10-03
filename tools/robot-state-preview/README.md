# 机器人状态组件预览

在仓库根目录运行 `npm run dev`，打开：

<http://localhost:1420/tools/robot-state-preview/>

预览直接使用 `RobotStateManager`、RM2026 Rule、新 robotStore 和真实 protobuf 编码。
七个场景覆盖等待、正常、零血量、超时、断线、重连等待以及重连恢复。
它只在本地模拟消息，不连接 MQTT Broker。

蓝方视角：<http://localhost:1420/tools/robot-state-preview/?clientId=103>

可通过 `scenario=missing|live|zero|timeout|disconnected|reconnected|recovered` 指定初始场景。
