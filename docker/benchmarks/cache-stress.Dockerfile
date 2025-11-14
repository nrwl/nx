# syntax=docker/dockerfile:1.7
FROM ubuntu:22.04 AS toolchain
ARG DEBIAN_FRONTEND=noninteractive
ARG NODE_VERSION=20
ARG PYTHON_PIP_VERSION=24.2
ARG GO_VERSION=1.22.7
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential clang cmake ninja-build git curl ca-certificates unzip \
    python3 python3-pip python3-venv openjdk-17-jdk maven gradle \
    wget jq parallel \
  && rm -rf /var/lib/apt/lists/*

RUN curl -fsSL "https://deb.nodesource.com/setup_${NODE_VERSION}.x" | bash - \
 && apt-get install -y --no-install-recommends nodejs \
 && rm -rf /var/lib/apt/lists/*

RUN arch="$(dpkg --print-architecture)" \
 && case "${arch}" in \
      amd64) go_arch=amd64 ;; \
      arm64) go_arch=arm64 ;; \
      *) echo "Unsupported arch: ${arch}" && exit 1 ;; \
    esac \
 && curl -fsSL "https://go.dev/dl/go${GO_VERSION}.linux-${go_arch}.tar.gz" -o /tmp/go.tgz \
 && tar -C /usr/local -xzf /tmp/go.tgz \
 && rm /tmp/go.tgz \
 && ln -sf /usr/local/go/bin/* /usr/local/bin/
ENV RUSTUP_HOME=/usr/local/rustup \
    CARGO_HOME=/usr/local/cargo \
    NX_INTERACTIVE=false \
    PATH=/usr/local/cargo/bin:$PATH
RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain stable

# Language-specific dependency storms
RUN npm install -g pnpm@9.11.0 typescript@5.5.4 \
 && pip install --no-cache-dir --upgrade pip==${PYTHON_PIP_VERSION} \
 && pip install --no-cache-dir numpy pandas scipy scikit-learn torch==2.3.0 \
 && cargo install ripgrep fd-find \
 && go install golang.org/x/tools/gopls@v0.15.3

# Build workloads to create real artifacts
RUN git clone --depth=1 https://github.com/openssl/openssl.git /opt/openssl \
 && cd /opt/openssl && ./Configure && make -j"$(nproc)" && make install_sw

RUN git clone --depth=1 https://github.com/spring-guides/gs-maven.git /opt/gs-maven \
 && cd /opt/gs-maven/complete && mvn -B -DskipTests package

RUN npx --yes create-nx-workspace@latest cachebench \
      --preset=apps --ci=skip --packageManager=pnpm --interactive=false \
 && cd cachebench && pnpm install && pnpm nx run-many -t lint,test,build

# Allow controlling sheer size without reworking steps
ARG FILLER_MB=2048
RUN mkdir -p /opt/artifacts \
 && fallocate -l "${FILLER_MB}M" /opt/artifacts/filler.img \
 && du -sh /opt/artifacts

FROM ubuntu:22.04
ARG CREATED_BY=docker-cache-bench
LABEL org.opencontainers.image.source="https://github.com/your/repo" \
      org.opencontainers.image.title="docker-cache-bench" \
      org.opencontainers.image.created-by="${CREATED_BY}"
COPY --from=toolchain /usr/local /usr/local
COPY --from=toolchain /opt /opt
ENV PATH="/usr/local/bin:${PATH}"
CMD ["bash","-lc","echo 'Cache benchmark image ready'"]
