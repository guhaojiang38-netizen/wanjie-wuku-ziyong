"""Build the browser extension only; retain development inputs in the source tree."""
from pathlib import Path
import argparse
import json
import re
import zipfile

parser = argparse.ArgumentParser()
parser.add_argument('--root', type=Path, default=Path(__file__).resolve().parents[1])
parser.add_argument('--out', type=Path, required=True)
args = parser.parse_args()
root = args.root.resolve()
manifest = json.loads((root / 'manifest.json').read_text(encoding='utf-8'))
files = ['index.js', 'manifest.json', 'style.css', 'LICENSE', 'NOTICE.md']
files += sorted(p.relative_to(root).as_posix() for p in (root / 'src').glob('*.js'))
for entry in [manifest['js'], manifest['css']]:
    if entry not in files:
        raise ValueError('Manifest entry missing from release')
for name in files:
    path = root / name
    if not path.is_file():
        raise ValueError(f'Missing release input: {name}')
    if path.suffix == '.js':
        for value in re.findall(r"(?:from\s*|import\s*)['\"](\.[^'\"]+)['\"]", path.read_text(encoding='utf-8')):
            dependency = (path.parent / value).resolve().relative_to(root).as_posix()
            if dependency not in files:
                raise ValueError(f'Runtime import excluded: {name} -> {dependency}')
readme = f'''# 万界武库 {manifest['version']}

安装：将ZIP中的wanjie-wuku文件夹放入酒馆的public/scripts/extensions/third-party/，
更新前备份旧文件夹，覆盖后在浏览器按Ctrl+F5。聊天与API设置保存在酒馆账户，不在本安装包中。

“发送设置与预览”控制把已保存档案附加给正文 AI；开启自动发送后无需逐项选择。
“从正文整理档案”则会调用插件 API 提取成果，两者独立。
顶部调色板按钮可以切换武库主题，默认跟随酒馆。
武库、漫漫长路、太始天有独立入口与视觉风格，沿用六种主题；统计只来自已保存档案。
太始天可从自选个人世界书建立底稿，先预览确认；已有现状优先保留。
AI拟定后可用一句话提修改意见，参考上一稿调整；失败保留原稿。
采用后点击“下轮待发”统一预览或撤回，回到酒馆发送消息时带入；不会自动发送或自动发奖。
按任务选择模型在AI连接设置中，默认沿用当前连接。真实模型效果取决于所选连接；验证范围见随包RELEASE-1.0.md。
设置内点击“新建方案”，填写名称、地址、Key和模型，点击“保存方案并使用”；选择已有方案即可切换。
“仅保存当前连接”不覆盖已命名的方案。删除方案保留当前连接。

开发用JSON、测试、构建脚本和完整开发文档未打包；运行所需配置已在src模块中。
完整文档与自编适配示例请使用源码仓库。更新不需要重新导入世界书或重新接入词条。
内置2026-10-11新版武库119条规则（作者导出120条中仅保留新版升变之印），可直接选择接入。
打开旧聊天时自动升级可识别的原版规则，保留余额、档案、历史和记忆选择；玩家自编规则保留。
人生模拟次数可累计，已结算实力、永久天赋和次数与外部线索分开记录。
升级后旧规则下尚未执行的拟定方案需要重新生成，既有成果不受影响。

漫漫长路：八模块显示专属家底与进展，AI整理时逐步补齐旧档案；明确关联的成果可互相查看并参与正文记忆。
模块内点击规划/推演等按钮，可直接使用预填目标拟定路线，预览采用后下一轮正文承接，实际成果仍由剧情整理回来。

最近一次整理下可撤销最近一笔整理或纠错；只恢复本次涉及的记录，不回滚正文或角色变量。
普通金手指在“纠错与其他记录”、漫漫长路在“近期变化与历史”打开“一句话纠错与阶段回顾”。
纠错或合并先看AI预览，确认后保存；合并不相加数量，保留历史，旧待执行方案需重新拟定。
场景建议可勾选“保留这条路线”，只重生成其他方向；全部保留时不会请求AI。
新聊天默认自动带入成果记忆；旧聊天沿用原开关选择。AI纠错、回顾和路线重生成使用现有连接。
插件 AI 参考世界书：在连接设置或管理与备份中选择“插件 AI 参考世界书”，支持跟随角色卡或手动选择。
勾选条目后预览并保存，选择随当前聊天保留。所有插件AI请求都会读取所选条目的最新内容，不受正文关键词触发限制。
参考设定帮助理解角色与能力，不自动授予能力；条目缺失或超过80000字符会提示处理，不悄悄截断。
运行日志：在连接设置或管理与备份打开，自动保留本浏览器当前账户最近40次任务，可导出JSON反馈问题。
默认记录楼层、过滤统计、校验原因和耗时；需要排错时临时开启请求与返回记录，刷新后自动关闭该开关。
正文整理可读取带标签的状态快照并排除思考/选项；单条校验失败独立列出，有效更新仍可保存，失败批次不标成全部完成。
来源位置和引文仅作参考，不因正文追加、编辑、隐藏或重生成而让已存成果失效。无需清空档案或重新接续历史。
混合剧情按所属金手指整理，再进入各自统计模块；其他金手指对象单独跳过，详情见运行日志。
已存错放记录：打开对象详情，展开“更正所属金手指”，选择正确词条并确认；内容与历史保留。目标已有同名记录时保留目标现状、合并历史，不累加数量。
太始天：顶部独立入口；沿用已有完整版词条与档案ID，不重复接入，不内置个人示例世界。
诸界、眷属、众生文明、发展事项、可调用成果、界主所得与其他旧记录分开查看。
选择个人世界书条目后点击“从我的世界书建立底稿”，先预览确认再保存，不推进正文读取进度；已有现状优先保留。
开启自动更新后沿用共享后台队列、日志、撤销与正文记忆，不按电脑时间演化世界，不重复执行世界引擎。
连接设置的“按任务选择模型”可把整理、拟定、终端、初始化、其他核对分配给不同已保存API方案；默认沿用当前连接。
总开关关闭时全部暂停，不额外增加自动调用，不在失败后自动切换模型。API方案与密钥仅保存在账户设置，不进入聊天备份。

1.0.0发布包：本地回归与打包验证已完成；真实模型质量、实际手机与第三方插件组合不宣称全部通过。详细验证范围见RELEASE-1.0.md。

'''
args.out.parent.mkdir(parents=True, exist_ok=True)
with zipfile.ZipFile(args.out, 'w', compression=zipfile.ZIP_DEFLATED, compresslevel=9) as z:
    for name in files + ['README.md', 'RELEASE-1.0.md']:
        info = zipfile.ZipInfo('wanjie-wuku/' + name, date_time=(1980, 1, 1, 0, 0, 0))
        info.compress_type = zipfile.ZIP_DEFLATED
        info.external_attr = 0o644 << 16
        z.writestr(info, readme.encode('utf-8') if name == 'README.md' else (root / name).read_bytes())
with zipfile.ZipFile(args.out) as z:
    assert z.testzip() is None
    assert not any('/data/' in n or '/tests/' in n for n in z.namelist())
    print(json.dumps({'version': manifest['version'], 'files': len(z.infolist()), 'uncompressedBytes': sum(i.file_size for i in z.infolist()), 'zipBytes': args.out.stat().st_size, 'path': str(args.out)}, ensure_ascii=False))
