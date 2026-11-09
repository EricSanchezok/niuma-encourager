# 贡献指南

感谢参与牛马鼓励器的改进。

## 开始前

1. Fork 仓库并创建功能分支。
2. 安装 Node.js、pnpm 和 Rust。
3. 运行 `pnpm install`。
4. 使用 `pnpm tauri dev` 检查桌面窗口行为。

## 提交代码

提交前运行以下命令。

```bash
pnpm lint
pnpm test
pnpm build
```

提交信息使用清晰的动词开头，例如 `fix calendar override precedence` 或 `add mini window layout`。

## 报告问题

请说明系统、应用版本、安装包类型、复现步骤和预期行为。涉及工资或排班时请使用脱敏数据。

## 设计原则

界面优先展示实时收入和工作进度。避免重复标签、无意义装饰和依赖平台毛玻璃效果的视觉实现。新增设置需要同时考虑键盘操作、对比度和窗口缩放。
