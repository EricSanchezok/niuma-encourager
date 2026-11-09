# 牛马鼓励器

把工作时间换算成收入的桌面小工具。完整悬浮窗和迷你悬浮窗都能显示今日已赚、下班倒计时和工时进度，设置与排班保存在本机。

[下载 macOS](https://github.com/EricSanchezok/niuma-encourager/releases/latest/download/niuma-encourager_macos-universal.dmg) · [下载 Windows](https://github.com/EricSanchezok/niuma-encourager/releases/latest/download/niuma-encourager_windows-x64-setup.exe) · [下载 Linux](https://github.com/EricSanchezok/niuma-encourager/releases/latest/download/niuma-encourager_linux-x86_64.AppImage) · [全部安装包](https://github.com/EricSanchezok/niuma-encourager/releases/latest)

## 安装

| 系统 | 安装包 | 使用方式 |
| --- | --- | --- |
| macOS 12+，Apple 芯片或 Intel | [Universal DMG](https://github.com/EricSanchezok/niuma-encourager/releases/latest/download/niuma-encourager_macos-universal.dmg) | 打开后将应用拖入“应用程序” |
| Windows 10/11，x64 | [Setup EXE](https://github.com/EricSanchezok/niuma-encourager/releases/latest/download/niuma-encourager_windows-x64-setup.exe) | 双击安装，安装程序会检查 WebView2 |
| Linux，x86_64 | [AppImage](https://github.com/EricSanchezok/niuma-encourager/releases/latest/download/niuma-encourager_linux-x86_64.AppImage) | 赋予执行权限后双击 |
| Ubuntu 22.04+/Debian 12+，amd64 | [DEB](https://github.com/EricSanchezok/niuma-encourager/releases/latest/download/niuma-encourager_linux-amd64.deb) | 双击安装，或使用 `sudo apt install ./niuma-encourager_linux-amd64.deb` |

首版安装包未进行 Apple 公证或 Windows 代码签名。macOS 首次打开被拦截时，进入“系统设置 → 隐私与安全性”选择“仍要打开”。Windows SmartScreen 提示时，确认文件来自本仓库 Releases 后选择“更多信息 → 仍要运行”。

Linux AppImage 先执行 `chmod +x niuma-encourager_linux-x86_64.AppImage`。系统需要 WebKitGTK 4.1、GTK 3 和 AppIndicator。缺少 FUSE 的系统可安装发行版对应的 FUSE 2 兼容包，或使用 `.deb`。不同桌面环境对托盘、窗口位置和置顶的支持有所差异。

## 使用

- 进入设置填写月薪、每周工作日、上下班时间、午休和激励目标。
- 图钉切换窗口置顶，缩小图标切换迷你窗，拖动顶部可移动窗口。
- 关闭按钮隐藏窗口，托盘菜单可重新显示窗口或完全退出。
- 工作日历中点击日期可调整上班或休息，再次点击恢复默认安排。
- 内置中国大陆 2025–2026 年节假日和补班数据。其他年份使用每周排班，支持手动调整。

首次启动使用月薪 ¥17,500、周一至周五 10:30–19:00、午休 12:00–13:30 和 ¥2,500 的示例目标。修改设置后会自动使用你的数据。

## 计算方式

时薪等于月薪除以当月排班应计薪总工时。今日收入只在当天有效工作时段累计，午休、休息日和节假日不累计。用户对单日的调整优先于内置节假日，内置节假日优先于每周排班。

本月累计由本月已过去的排班工时和当天进度计算。修改薪资、工作时间或日历后会重新计算本月金额。激励目标使用本月累计收入计算还需工作多久。

应用使用系统本地时区和当前时间重新计算，电脑睡眠、应用关闭或离线期间的排班时间仍可正确显示。这个金额用于个人进度展示，实际工资以雇主结算为准。

## 本地开发

需要 Node.js 22、pnpm 11.7.0、Rust stable 和对应系统的 [Tauri 开发依赖](https://v2.tauri.app/start/prerequisites/)。

```bash
pnpm install
pnpm tauri dev
```

```bash
pnpm lint
pnpm test
pnpm build
cargo check --manifest-path src-tauri/Cargo.toml --locked
pnpm tauri build
```

前端使用 React、TypeScript 和 Vite，原生窗口使用 Tauri 2。领域计算以传入时间为准，可以用固定时钟测试跨日、跨月和午休。

## 发布

更新 `package.json`、`src-tauri/Cargo.toml` 和 `src-tauri/tauri.conf.json` 的版本后，推送匹配的版本标签，例如 `v0.1.0`。GitHub Actions 先执行检查，再构建三平台安装包。全部构建成功后统一公开 Release，并生成 `SHA256SUMS.txt`。

## 数据与隐私

设置和工作日历覆盖保存在操作系统的应用数据目录中。应用无需账号，薪资、排班和收入数据在本机计算。节假日数据随应用版本更新。

## 贡献与许可证

贡献方式见 [CONTRIBUTING.md](CONTRIBUTING.md)。报告问题时请附系统、应用版本和复现步骤，并去除截图中的个人薪资。

本项目使用 [MIT License](LICENSE)。
