# Holdem Lab

用于 No-Limit Texas Hold'em 科普、学习、虚拟筹码练习与决策复盘的开源项目。
默认英语，提供独立撰写的简体中文版本。当前为早期、由维护者主导的项目，
可独立本地运行，本仓库不承诺提供托管服务。

只使用虚拟筹码。不连接真实牌桌，不处理资金或可兑现资产，不提供实时辅助、HUD、
自动下注或奖金。策略反馈是有明确假设的近似分析，不是 solver 数据，也不承诺盈利。

[English](README.md) · [文档入口](docs/README.md) · [产品说明](docs/product.md)

## 本地运行

准备 Ruby **4.0.2**、Node **24.14.0**、Bundler、npm 和原生编译工具：

```bash
git clone https://github.com/yorzi/holdem-lab.git
cd holdem-lab
bin/setup --skip-server
bin/dev
```

打开 http://127.0.0.1:3100/zh 。前台按 **Ctrl-C** 停止整个开发进程组。
启动脚本安装锁定依赖、准备 SQLite、导入并校验内容镜像。无需 GCP、Docker、
生产密钥、邮件服务、LLM、solver 或统计账号；安装依赖需要联网。
详细要求和排错见 [本地启动指南](docs/getting-started.md)。

## 试用路径

先读 `/zh/learn` 的位置、底池赔率、决策质量课程，再到 `/zh/practice` 练习，
填写理由与信心后作出行动，在 Review Queue 复盘。首次练习无需注册。
已保存的练习记录保存在当前浏览器，刷新会重置正在进行的手牌。

本地账户、资料、账户导出和账户删除已实现；这不代表自动上传或跨设备同步已完成。
生产导入保持关闭。所有环境默认关闭外部统计。
自动化测试也不等于独立扑克领域审核、人工辅助技术检查或学习效果验证。

## 开发与贡献

```bash
bin/ci
```

完整检查包含 Rails、浏览器、TypeScript、构建、内容校验和安全扫描。
浏览器测试需要 Chrome/Chromium，依赖漏洞检查需要联网。
请参阅 [开发指南](docs/development.md)、[贡献指南](CONTRIBUTING.md) 和
[安全报告方式](SECURITY.md)。本仓库只包含当前应用、测试和经过筛选的文档。

项目原创代码和文档使用 [MIT](LICENSE)；外部引用、第三方依赖与素材仍遵循其各自权利。
详见 [第三方说明](THIRD_PARTY_NOTICES.md)。
