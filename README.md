# Zotero 科研通文献求助助手

本项目由两个本地组件组成：

- Zotero 插件：读取当前选中的单篇文献元数据，并打开科研通求助页面。
- Chrome/Edge 扩展：接收元数据、辅助 DOI 查询和表单填写。

扩展**不会自动点击最终“发布求助”按钮**。请在网页中检查标题、DOI、作者、期刊、年份和官网链接后，由你手动发布。

## 兼容范围

- Zotero：针对 `9.0-beta.21+1a89239a1` 64 位开发。
- 浏览器：支持当前 Chrome 和 Microsoft Edge 的 Manifest V3 扩展。
- 网站：`https://www.ablesci.com/`。

Zotero 9 仍是 beta 版本，内部界面接口可能变化。升级 Zotero 后，应重新执行 `docs/manual-test-checklist.md`，确认兼容后再继续使用。

## 构建

需要 Node.js `22.13.0` 或更高版本。

```powershell
npm install
npm run verify
```

构建结果：

- `dist/zotero-ablesci-assistant-0.1.2.xpi`
- `dist/ablesci-chromium-extension-0.1.2.zip`
- `dist/chromium/`：浏览器开发者模式可直接加载的目录

## 安装 Zotero 插件

1. 打开 Zotero。
2. 进入“工具”→“插件”。
3. 点击右上角齿轮，选择“从文件安装插件”。
4. 选择 `dist/zotero-ablesci-assistant-0.1.2.xpi`。
5. 按提示重启 Zotero。
6. 确认工具栏出现“科研通求助”，文献右键菜单出现“在科研通发起文献求助”。

## 安装 Chrome 扩展

1. 解压 `dist/ablesci-chromium-extension-0.1.2.zip`，或直接使用 `dist/chromium/`。
2. 在 Chrome 打开 `chrome://extensions`。
3. 开启右上角“开发者模式”。
4. 点击“加载已解压的扩展程序”。
5. 选择解压目录或 `dist/chromium/`。

## 安装 Edge 扩展

1. 解压浏览器扩展 ZIP。
2. 在 Edge 打开 `edge://extensions`。
3. 开启“开发人员模式”。
4. 点击“加载解压缩的扩展”。
5. 选择解压目录或 `dist/chromium/`。

## 使用方法

1. 在 Zotero 文献列表中选择**一篇普通文献条目**。
2. 确认该条目已有标题等元数据，但没有 PDF 附件。
3. 点击工具栏“科研通求助”，或右键选择“在科研通发起文献求助”。
4. 默认浏览器会打开科研通。
5. 尚未登录时，先手动登录；同一浏览器会话内会继续当前填表任务。
6. 有 DOI 时，扩展会填写 DOI 并点击“查询”。
7. 科研通查询结果优先；Zotero 只补充空字段。
8. 黄色状态表示科研通与 Zotero 数据存在差异，请人工核对。
9. 检查所有字段后，由你手动点击科研通最终发布按钮。

首版只支持单篇文献，不支持批量或连续发布。

## 阻止条件

插件会在以下情况停止：

- 未选择文献。
- 同时选择多篇文献。
- 选择的是附件、笔记或批注，而不是普通文献条目。
- 条目缺少标题。
- 条目已经包含本地、链接或远程 PDF 附件。

## 无 DOI 或查询失败

- 无 DOI 时仍会填写 Zotero 中已有的标题、作者、期刊、年份和官网链接。
- DOI 查询失败或超时时，会自动改用 Zotero 元数据填充空字段。
- DOI 和官网链接都缺失时，状态条会提示补充官网链接。
- 不会把第三方检索页链接伪装成出版社官网链接。

## 未安装浏览器扩展

Zotero 仍会打开科研通，并将可读元数据复制到剪贴板。此时 URL 中的 `#zotero-ablesci=...` 临时片段不会被自动清除，但片段不会随 HTTP 请求发送给科研通服务器。你可以手动删除地址栏片段，并粘贴剪贴板内容完成填写。

## 隐私与安全

- 浏览器扩展仅申请科研通域名和会话存储权限。
- 临时数据使用 `chrome.storage.session`，关闭浏览器会话后自动清除。
- URL 载荷读取后立即从地址栏移除。
- 不读取、保存或导出科研通账号、密码、Cookie。
- 不发送遥测，不连接开发者服务器。
- 不绕过验证码、积分或网站风控。
- 不自动提交表单。

## 故障排查

### Zotero 没有出现按钮

- 确认 Zotero 版本处于支持范围。
- 在“工具”→“插件”中确认插件已启用。
- 重启 Zotero 后再次检查。
- 查看 Zotero 调试输出中是否存在 `[AbleSci Assistant]` 相关错误。

### 科研通页面没有自动填写

- 确认浏览器扩展已启用，且当前页面属于 `www.ablesci.com`。
- 点击状态条中的“复制全部元数据”，改为手动填写。
- 科研通改版后，页面字段可能无法被安全识别；扩展会停止而不会猜测点击。

如需报告页面改版，请只提供已脱敏的字段标签、元素 `name`/`id` 和按钮文本。不要提供账号、密码、Cookie、验证码、积分信息或完整个人页面截图。

## 卸载

### Zotero

进入“工具”→“插件”，找到“Zotero 科研通文献求助助手”，选择移除并重启 Zotero。

### Chrome/Edge

进入浏览器扩展管理页，找到“Zotero 科研通文献求助助手”，点击移除。

## 开发验证

```powershell
npm test
npm run build
node scripts/verify-artifacts.mjs
```

实机验收记录见 `docs/manual-test-checklist.md`。
