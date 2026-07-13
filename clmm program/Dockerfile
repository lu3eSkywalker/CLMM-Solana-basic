FROM ubuntu:24.04

ENV DEBIAN_FRONTEND=noninteractive
ENV HOME=/root
ENV PATH="/root/.cargo/bin:/root/.local/share/solana/install/active_release/bin:$PATH"
ENV ANCHOR_HOME="/root/.anchor"
ENV NVM_DIR="/root/.nvm"

RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    jq \
    libssl-dev \
    pkg-config \
    libudev-dev \
    libclang-dev \
    protobuf-compiler \
    bzip2 \
    && rm -rf /var/lib/apt/lists/*

RUN curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.4/install.sh | bash \
    && . "$NVM_DIR/nvm.sh" \
    && nvm install 22.23.1 \
    && nvm use 22.23.1 \
    && nvm alias default 22.23.1

ENV NODE_PATH="/root/.nvm/versions/node/v22.23.1/lib/node_modules"
ENV PATH="/root/.nvm/versions/node/v22.23.1/bin:$PATH"

RUN npm install -g npm@11

RUN curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y --default-toolchain 1.96.0 \
    && . "$HOME/.cargo/env" \
    && rustup default 1.96.0

RUN . "$HOME/.cargo/env" \
    && cargo install --git https://github.com/coral-xyz/anchor --tag v0.32.1 anchor-cli --locked

RUN sh -c "$(curl -sSfL https://release.anza.xyz/v2.3.0/install)"

WORKDIR /workspace

CMD ["bash"]
