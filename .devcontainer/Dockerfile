FROM mcr.microsoft.com/devcontainers/base:ubuntu

# Node v20 setup - refer to below URL for details
# https://github.com/nodesource/distributions?tab=readme-ov-file#using-ubuntu-nodejs-20
RUN apt-get install -y curl \
    && curl -fsSL https://deb.nodesource.com/setup_20.x -o nodesource_setup.sh \
    && bash nodesource_setup.sh \
    && apt-get install -y nodejs \
    && node -v  # verify Node installation

# Ghost setup
RUN npm install ghost-cli@latest -g
USER vscode
RUN mkdir ~/ghost \
    && cd ~/ghost \
    && ghost install local
