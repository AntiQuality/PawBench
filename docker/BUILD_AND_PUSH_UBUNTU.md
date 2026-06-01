# Ubuntu 构建并推送 PawBench 镜像到 ACR

> **背景**：PawBench 评测平台（Agent-Platform）的 Kubernetes 节点是 `linux/amd64`，但 macOS（Apple Silicon）原生 `docker build` 出来的是 `linux/arm64`，集群拉起来会报 `exec /usr/bin/bash: exec format error`。本文档指导你**在 x86_64 Ubuntu 机器上**构建三个 PawBench Agent 镜像（copaw / openclaw / hermes）并推送到阿里云 ACR。
>
> **本文档自包含** —— 不依赖 `examples/` 目录，所有命令都从仓库根 `copawbench/` 执行。
>
> **预计耗时**：首次构建 ~30-40 分钟（三个镜像并行约 15 分钟）+ 推送 ~5 分钟。后续重建（layer cache 命中）<10 分钟。

---

## 标准构建方式：远程服务器构建 + 本地推送（推荐）

> 适用场景：构建服务器（47.57.13.2）因安全组限制无法直连 ACR 公网端点，但本地 macOS 可以推送。
> 整体流程：**本地 push 代码 → 服务器 git pull + docker build（利用层缓存，~30 秒）→ SSH 管道流式传到本地 → 本地推 ACR**。

### 快速执行脚本（从本地 macOS 运行）

```bash
#!/usr/bin/env bash
set -euo pipefail

BUILD_SERVER="root@47.57.13.2"
BUILD_DIR="/root/boyin.liu/code/harbor/examples/OpenJudge/examples/copawbench"
REGISTRY="agent-platform-staging-registry.ap-southeast-1.cr.aliyuncs.com"
COLIMA_SOCK="unix:///Users/boyin.liu/.colima/default/docker.sock"

# ── 步骤 1：在构建服务器上 git pull 并构建 ──────────────────────────────
TAG=$(ssh ${BUILD_SERVER} "
  cd ${BUILD_DIR}
  git pull origin feat/agenthub-on-opensource
  TAG=\"dev-\$(git rev-parse --short HEAD)-\$(date -u +%Y%m%d-%H%M)\"
  echo \"\$TAG\" > /tmp/pawbench_build_tag.txt

  # 并行构建三个镜像（层缓存命中时约 30 秒）
  docker build -f docker/Dockerfile.pawbench-copaw    -t pawbench-copaw:\${TAG}    -t pawbench-copaw:test    . > /tmp/build-copaw.log    2>&1 &
  docker build -f docker/Dockerfile.pawbench-openclaw -t pawbench-openclaw:\${TAG} -t pawbench-openclaw:test . > /tmp/build-openclaw.log 2>&1 &
  docker build -f docker/Dockerfile.pawbench-hermes   -t pawbench-hermes:\${TAG}   -t pawbench-hermes:test   . > /tmp/build-hermes.log   2>&1 &
  wait
  echo \"\$TAG\"
")
echo "TAG=${TAG}"

# ── 步骤 2：本地登录 ACR ────────────────────────────────────────────────
DOCKER_HOST=${COLIMA_SOCK} docker login \
  -u E-vivi.ww-88205@1458867964644701 \
  -p agent-platform-staging \
  ${REGISTRY}

# ── 步骤 3：SSH 管道传输 + 推送（顺序执行）────────────────────────────
for agent in copaw openclaw hermes; do
  echo "=== transferring & pushing pawbench-${agent} ==="
  ssh ${BUILD_SERVER} "docker save pawbench-${agent}:${TAG} | gzip" \
    | DOCKER_HOST=${COLIMA_SOCK} docker load
  DOCKER_HOST=${COLIMA_SOCK} docker tag \
    pawbench-${agent}:${TAG} \
    ${REGISTRY}/eflops/pawbench-${agent}:${TAG}
  DOCKER_HOST=${COLIMA_SOCK} docker push \
    ${REGISTRY}/eflops/pawbench-${agent}:${TAG}
  echo "pawbench-${agent} pushed ✓"
done

# ── 步骤 4：输出 TAG 和 digest ──────────────────────────────────────────
echo ""
echo "=========================================="
echo "TAG=${TAG}"
for agent in copaw openclaw hermes; do
  digest=$(DOCKER_HOST=${COLIMA_SOCK} docker inspect \
    ${REGISTRY}/eflops/pawbench-${agent}:${TAG} \
    --format '{{index .RepoDigests 0}}' 2>/dev/null | awk -F'@' '{print $2}')
  echo "pawbench-${agent}: ${digest}"
done
echo "=========================================="
echo "下一步：更新 examples/agent-repos/Agent-Hub/task/pawbench-*/config.yaml 的 image: 字段"
```

> **注意事项**：
> - 运行前确保本地 colima 已启动（`colima status`）
> - SSH 到构建服务器需要密钥免密登录（`ssh-copy-id root@47.57.13.2`）
> - 每个镜像 SSH 管道传输约 5 分钟（压缩后 ~1GB），三个共约 15-20 分钟
> - 传输完成后务必更新 `config.yaml` 并 commit 到 `feat/add_pawbench`

---

## 0. 前置确认

执行下面这段，三项都要 OK 才能继续：

```bash
# 0.1 必须是 x86_64
uname -m
# 期望：x86_64

# 0.2 Docker 已安装且能连 daemon
docker version
docker info | grep -i "Architecture\|Operating System"
# 期望 Architecture: x86_64

# 0.3 仓库根目录正确（仓库是 copawbench）
cd ~/path/to/copawbench
ls docker/Dockerfile.pawbench-copaw \
   docker/Dockerfile.pawbench-openclaw \
   docker/Dockerfile.pawbench-hermes \
   pawbench/__init__.py \
   run_bench.py \
   requirements.txt \
   .dockerignore
# 全部不报错 = OK
```

如果 `docker info` 报 `permission denied`：

```bash
sudo usermod -aG docker $USER
newgrp docker        # 当前 shell 立即生效；其他 shell 需重登录
```

---

## 1. 登录阿里云 ACR（公网 endpoint）

```bash
docker login \
  -u E-vivi.ww-88205@1458867964644701 \
  -p agent-platform-staging \
  agent-platform-staging-registry.ap-southeast-1.cr.aliyuncs.com
# 期望末尾输出："Login Succeeded"
```

> **注**：登录的是公网 `agent-platform-staging-registry.ap-southeast-1.cr.aliyuncs.com`（不带 `-vpc`）。`config.yaml` 里的 image 字段写的是 VPC endpoint —— 集群从内网拉镜像走 VPC，本机推送走公网，两者指向同一个仓库（同一个 namespace `eflops`）。

---

## 2. 生成统一 TAG（三个镜像共用同一个 TAG）

```bash
cd ~/path/to/copawbench    # 仓库根
TAG="dev-$(git rev-parse --short HEAD)-$(date -u +%Y%m%d-%H%M)"
REGISTRY="agent-platform-staging-registry.ap-southeast-1.cr.aliyuncs.com"
echo "TAG=${TAG}"
echo "REGISTRY=${REGISTRY}"
# 例：TAG=dev-9b5ac0c-20260508-0812
```

**记下 `${TAG}`** —— 后面构建、推送、改 `Agent-Hub/task/pawbench-*/config.yaml` 的 `image:` 字段都要用同一个值。

---

## 3. 构建三个镜像

仓库根有 `.dockerignore` 已排除 `examples/ benchmarks/ results/ .git/` 等，build context 只有 ~330 KB。

> 三个 Dockerfile 都是 `linux/amd64` 默认（`FROM python:3.11-slim` / `FROM node:22-slim`），在 Ubuntu x86_64 上 `docker build` 不需要任何 `--platform` 参数。

### 3.1 顺序构建（推荐 —— 显存/磁盘 I/O 友好）

```bash
cd ~/path/to/copawbench

# (1) copaw —— qwenpaw + xfce4 + chromium + node20，约 12-15 分钟
docker build \
  -f docker/Dockerfile.pawbench-copaw \
  -t pawbench-copaw:${TAG} \
  -t pawbench-copaw:test \
  .

# (2) openclaw —— openclaw + xfce4 + chromium，约 10 分钟
docker build \
  -f docker/Dockerfile.pawbench-openclaw \
  -t pawbench-openclaw:${TAG} \
  -t pawbench-openclaw:test \
  .

# (3) hermes —— hermes + xfce4 + chromium，约 10 分钟
docker build \
  -f docker/Dockerfile.pawbench-hermes \
  -t pawbench-hermes:${TAG} \
  -t pawbench-hermes:test \
  .
```

> 同时打两个 tag（`:${TAG}` 和 `:test`）：`:${TAG}` 用于推 ACR；`:test` 用于本地 `LocalDockerExecutor` 自测。

### 3.2 并行构建（机器内存 ≥ 32 GB 时再用）

```bash
docker build -f docker/Dockerfile.pawbench-copaw    -t pawbench-copaw:${TAG}    -t pawbench-copaw:test    . > /tmp/build-copaw.log    2>&1 &
docker build -f docker/Dockerfile.pawbench-openclaw -t pawbench-openclaw:${TAG} -t pawbench-openclaw:test . > /tmp/build-openclaw.log 2>&1 &
docker build -f docker/Dockerfile.pawbench-hermes   -t pawbench-hermes:${TAG}   -t pawbench-hermes:test   . > /tmp/build-hermes.log   2>&1 &
wait
echo "all builds done"
tail -5 /tmp/build-*.log
```

### 3.3 验证三个镜像

```bash
docker images | grep -E "pawbench-(copaw|openclaw|hermes)"
# 期望六行（三个 镜像 × 两个 tag）

# 验证架构（必须是 amd64！）
for img in pawbench-copaw pawbench-openclaw pawbench-hermes; do
  arch=$(docker inspect ${img}:test --format '{{.Architecture}}/{{.Os}}')
  echo "${img}: ${arch}"
done
# 期望全部输出 amd64/linux
```

---

## 4. Smoke Test（可跳过，但建议做）

让镜像内的关键二进制都跑一下 `--version`：

```bash
# (1) copaw
docker run --rm --platform linux/amd64 pawbench-copaw:test \
  bash -c 'qwenpaw --version && ossutil --version && python3 -c "import pawbench; print(\"pawbench OK\")"'

# (2) openclaw
docker run --rm --platform linux/amd64 pawbench-openclaw:test \
  bash -c 'openclaw --version && ossutil --version && python3 -c "import pawbench; print(\"pawbench OK\")"'

# (3) hermes
docker run --rm --platform linux/amd64 pawbench-hermes:test \
  bash -c 'hermes --version && ossutil --version && python3 -c "import pawbench; print(\"pawbench OK\")"'
```

任一项失败：

* `qwenpaw / openclaw / hermes` 不存在 → 检查对应 Dockerfile 的 `ARG` 版本号，能否走通官方 npm/pip 源
* `ossutil` 不存在 → 检查 `curl -fsSL https://gosspublic.alicdn.com/ossutil/...` 那一层是否 fail
* `import pawbench` 报 `ModuleNotFoundError` → `.dockerignore` 误伤了，确认 `pawbench/` 没在排除列表

---

## 5. 打 ACR tag 并推送

```bash
# 5.1 打 ACR tag
for agent in copaw openclaw hermes; do
  docker tag pawbench-${agent}:${TAG} ${REGISTRY}/eflops/pawbench-${agent}:${TAG}
done

# 验证
docker images | grep "${REGISTRY}/eflops/pawbench"
# 期望三行 ACR 标签

# 5.2 推送（并行，三个镜像约 5 分钟）
for agent in copaw openclaw hermes; do
  echo "=== pushing ${agent} ==="
  docker push ${REGISTRY}/eflops/pawbench-${agent}:${TAG} &
done
wait
echo "all pushes done"
```

成功输出末尾会有：
```
${TAG}: digest: sha256:xxxxx... size: NNNN
```

每个镜像出现一行 `digest: sha256:` 即推送成功。

---

## 6. 把 TAG 写回 Agent-Hub 的 config.yaml

> **注意**：你那台 Ubuntu **没有 `examples/Agent-Hub/`**。所以**把 `${TAG}` 复制下来**，回到我这边的 macOS（或者 Agent-Hub 的开发环境）改 3 个 `config.yaml`。

需要修改的 3 个文件（路径相对 `Agent-Hub` 仓库根）：

```
task/pawbench-copaw/config.yaml
task/pawbench-openclaw/config.yaml
task/pawbench-hermes/config.yaml
```

每个文件里的 `image:` 字段改为：

```yaml
image: "agent-platform-staging-registry-vpc.ap-southeast-1.cr.aliyuncs.com/eflops/pawbench-copaw:${TAG}"
# openclaw / hermes 同理（替换 -copaw 部分）
```

> `image:` 用 VPC endpoint，集群里走内网拉镜像更快；推送是公网。**TAG 必须严格相同**（同一次构建 = 同一个 TAG）。

修改完毕在 Agent-Hub 仓库：

```bash
cd Agent-Hub
git checkout feat/add_pawbench
git add task/pawbench-*/config.yaml
git commit -m "feat(pawbench): bump ACR image tag to ${TAG}"
git push origin feat/add_pawbench
```

---

## 7. 把 TAG 发回给我

构建+推送完毕，**把这 4 行内容贴回对话**：

```
TAG=dev-xxxxxxx-YYYYMMDD-HHMM
copaw    digest: sha256:xxxx
openclaw digest: sha256:xxxx
hermes   digest: sha256:xxxx
```

然后我这边就可以：

1. 改 3 个 `config.yaml` 的 `image:` 字段（如果你没改）
2. 推送 Agent-Hub `feat/add_pawbench` 分支
3. 提交 Phase 6 小样本任务到测试集群验收（3 个稳定任务）

---

## 8. 常见问题

### 8.1 `docker push` 报 `denied: requested access to the resource is denied`

* 重新执行步骤 1（重新登录 ACR）
* 检查 `docker login` 输出是否 `Login Succeeded`

### 8.2 构建 `apt-get update` 卡住或慢

国内 Ubuntu 一般默认源就够快。如果在境外 / 网络受限：

```bash
# 用阿里云镜像源（在 docker build 之前替换源）
sudo sed -i 's|http://archive.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list
sudo sed -i 's|http://security.ubuntu.com|http://mirrors.aliyun.com|g' /etc/apt/sources.list
```

### 8.3 构建 `pip install` 卡住

把 `Dockerfile` 里所有 `pip install` 加上 `-i`：

```dockerfile
# 找到形如：RUN pip install --no-cache-dir "qwenpaw==${QWENPAW_VERSION}"
# 改为：
RUN pip install --no-cache-dir -i https://mirrors.aliyun.com/pypi/simple/ \
        "qwenpaw==${QWENPAW_VERSION}"
```

不想改 Dockerfile 的话，可以把 host 的 pip 配置传进去：

```bash
# /etc/pip.conf 写镜像源后再 build（仅作用于本地 host，对 Docker build 没用）
# 推荐还是直接在 Dockerfile 里改，或者用 build arg 注入
```

### 8.4 推送报 `manifest mismatch`

集群只识别 `linux/amd64`。重新检查：

```bash
docker inspect pawbench-copaw:${TAG} --format '{{.Architecture}}/{{.Os}}'
# 必须是 amd64/linux
```

如果输出是 `arm64/linux`，说明你这台机其实不是 x86_64（再 `uname -m` 看看），换台 Ubuntu。

### 8.5 集群拉镜像报 `ImagePullBackOff`

通常是 ACR namespace / 密钥配错。检查：

* `Agent-Hub` 的 `image:` 字段是否用了 VPC endpoint（`-vpc.` 子域）
* TAG 是否与 ACR 上推送的 TAG **完全一致**（包含小写、连字符）
* ACR 控制台 → 镜像仓库 → 找到 `eflops/pawbench-copaw` → 看 tags 列表里有没有你推送的 TAG

---

## 9. 一键脚本（可选）

如果想一条命令跑完，把下面存为 `build_and_push.sh` 放在仓库根：

```bash
#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")"   # 切到仓库根

# 0. 前置检查
[ "$(uname -m)" = "x86_64" ] || { echo "ERROR: must run on x86_64"; exit 1; }
docker info >/dev/null      || { echo "ERROR: docker daemon unreachable"; exit 1; }

# 1. 配置
TAG="dev-$(git rev-parse --short HEAD)-$(date -u +%Y%m%d-%H%M)"
REGISTRY="agent-platform-staging-registry.ap-southeast-1.cr.aliyuncs.com"
echo "TAG=${TAG}"
echo "REGISTRY=${REGISTRY}"

# 2. 登录（如果已登录会复用 token）
docker login \
  -u "${ACR_USERNAME:-E-vivi.ww-88205@1458867964644701}" \
  -p "${ACR_PASSWORD:-agent-platform-staging}" \
  "${REGISTRY}"

# 3. 构建
declare -A DOCKERFILES=(
  [copaw]="docker/Dockerfile.pawbench-copaw"
  [openclaw]="docker/Dockerfile.pawbench-openclaw"
  [hermes]="docker/Dockerfile.pawbench-hermes"
)

for agent in copaw openclaw hermes; do
  echo "=== Building ${agent} ==="
  docker build \
    -f "${DOCKERFILES[$agent]}" \
    -t "pawbench-${agent}:${TAG}" \
    -t "pawbench-${agent}:test" \
    .
done

# 4. 验证架构
for agent in copaw openclaw hermes; do
  arch=$(docker inspect "pawbench-${agent}:test" --format '{{.Architecture}}/{{.Os}}')
  echo "pawbench-${agent}: ${arch}"
  [ "$arch" = "amd64/linux" ] || { echo "ERROR: ${agent} is not amd64"; exit 1; }
done

# 5. 推送
for agent in copaw openclaw hermes; do
  docker tag "pawbench-${agent}:${TAG}" "${REGISTRY}/eflops/pawbench-${agent}:${TAG}"
  echo "=== Pushing ${agent} ==="
  docker push "${REGISTRY}/eflops/pawbench-${agent}:${TAG}"
done

# 6. 输出 summary（请把这一段贴回对话）
echo ""
echo "=========================================="
echo "  Build & push DONE"
echo "=========================================="
echo "TAG=${TAG}"
for agent in copaw openclaw hermes; do
  digest=$(docker inspect "${REGISTRY}/eflops/pawbench-${agent}:${TAG}" \
    --format '{{index .RepoDigests 0}}' 2>/dev/null \
    | awk -F'@' '{print $2}')
  echo "pawbench-${agent}: ${digest}"
done
```

用法：

```bash
chmod +x build_and_push.sh
./build_and_push.sh
```

---

## 10. 完整时间线参考

| 步骤 | 预计耗时 |
|------|----------|
| `apt-get install` 系统包（每个镜像） | 2-4 分钟 |
| `pip install` qwenpaw / openclaw / hermes | 1-2 分钟 |
| `npm install -g` （openclaw / hermes） | 1-2 分钟 |
| Chromium + 字体（openclaw / hermes） | 3-5 分钟 |
| 三个镜像顺序构建 | 25-35 分钟 |
| 三个镜像并行推送（千兆网络） | 3-5 分钟 |
| **总计** | **30-40 分钟** |

二次构建（layer cache 命中）通常只需 5-10 分钟。
