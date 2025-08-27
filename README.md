# tyf_tool

## 运行时报错解决方案

### Mac

如果安装应用后打开时提示损坏，无法打开，请执行以下命令：

```bash
xattr -cr /Applications/TYF\ Tool.app
```

service 可执行文件无法运行

> 无法打开“tyf_tool_service”，因为 Apple 无法检查其是否包含恶意软件。

```bash
xattr -d com.apple.quarantine tyf_tool_service
```

## 本地开发

### 安装依赖

```bash
npm i
```

### 启动服务

```bash
# 依次执行以下命令
npm run build
npm run start
```

## 构建应用

> 将代码合到 master 或 main 分支后，流水线会自动构建应用（win, mac intel, mac apple）并将安装包上传至 Artifact

### 构建 Mac 应用

```bash
npm run package:mac
```

### 构建 Windows 应用

```bash
npm run package:win
```
