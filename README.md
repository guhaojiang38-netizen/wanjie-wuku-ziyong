# 万界武库 1.0.0

SillyTavern 金手指成果管理扩展。武库、漫漫长路、太始天各有独立入口，用于查看当前家底、进行中的安排和长期变化。

- **从正文整理档案**：手动或在回复完成后自动调用所选 AI，整理已有成果。
- **发送档案给正文 AI**：发送消息时带入相关长期记忆，与自动整理分别开关。
- **AI 拟定与操作台**：说出目标，预览并采用方案，随下一轮正文请求发送。
- **长期记录**：历史、撤销、纠错、备份，以及本地运行日志。

能力实际使用和行动结果交给正文；方案与计划不会直接变成已完成成果，也不会凭空发奖或扣资源。

## 安装

在酒馆的「扩展 → 安装扩展」中粘贴：

```text
https://github.com/feiluoze/wanjie-wuku
```

安装后刷新网页。最低酒馆版本声明为 1.12.14；具体能力还取决于宿主接口。

手动安装：在 [Releases](https://github.com/feiluoze/wanjie-wuku/releases) 下载 `wanjie-wuku-v1.0.0.zip`，解压后将 `wanjie-wuku` 放入 `SillyTavern/public/scripts/extensions/third-party/`。更新前备份旧扩展与聊天档案；不要删除酒馆 data 目录。

首次使用进入角色聊天，接入词条并保存 AI 连接方案，点击「AI 整理当前情况」。漫漫长路可直接查看八类统计；太始天可选择自己的世界书建立底稿。无需导入作者测试用角色卡。

日常操作、更新与验证范围见 [版本说明](RELEASE-1.0.md)。内置 2026-10-11 更新的武库 119 条唯一规则；适配提供统计与拟定指导，不代表所有机制都已自动结算。

## 隐私与第三方请求

插件没有内置遥测、广告服务或远程代码加载。运行时读取当前酒馆的聊天、设置与选定世界书；资料如何发给 AI 见 [隐私说明](PRIVACY.md)。

**第三方请求域名：由玩家配置的 API 地址决定，没有预设的固定第三方服务域名。** 使用酒馆连接时遵循酒馆当前的模型服务配置。自动整理与其他 AI 任务会消耗所选服务额度，可以关闭自动整理，也可以完全不调用插件 AI。

API 密钥与连接方案按账户保存，不随聊天档案备份导出。运行日志仅本地保存，详细请求/返回记录默认关闭；分享日志前请自行检查私人剧情和设定。

## 源码与构建

`index.js` 是入口，`src/` 包含完整可读运行源码，`data/` 是内置配置源，`scripts/` 是构建脚本，`tests/` 是离线与模拟宿主用例。没有隐藏的运行模块。

```sh
python scripts/build-release.py --root . --out dist/wanjie-wuku-v1.0.0.zip
node --test tests/*.test.js
```

部分回归测试需要通过 `WJWK_TEST_BOOK`、`WJWK_PREVIOUS_BOOK`、`WJWK_AUTHOR_BOOK`、`WJWK_PREVIOUS_ADAPTERS` 指定对应版本的公开规则测试输入。最新内置规则位于 `data/builtin-worldbook.json`；旧版外部输入不随发布包分发。模拟浏览器还需自行安装 Playwright，并设置 `WJWK_NODE_MODULES`、`WJWK_BROWSER_EXECUTABLE`、`WJWK_SCREENSHOTS`；主题参考测试需自备 `WJWK_THEME_DIR`，不会下载参考素材。

发布前已有 758 项离线自动测试通过及模拟宿主检查；这些结果不等同于 1.0.0 的真实酒馆、实际手机或所有插件组合验收。反馈时附版本、操作步骤与经过检查的运行日志。

## 许可与来源

原创代码采用 [MIT](LICENSE)；内置规则及第三方内容的权利见 [NOTICE](NOTICE.md)，不会因随包分发自动改成 MIT。参考项目见 [来源与致谢](ACKNOWLEDGEMENTS.md)。本仓库不包含玩家个人世界书、聊天记录、API 配置、参考脚本原文件或主题原文件。
