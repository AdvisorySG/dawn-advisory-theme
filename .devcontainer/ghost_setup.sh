#!/bin/bash

export REPO="/workspaces/dawn-advisory-theme"

# Step 1: Create symbolic link to theme
ln -s $REPO ~/ghost/content/themes

# Step 2: Start Ghost
cd ~/ghost
ghost start

# Step 3: Install dependencies + run setup script
cd $REPO/.devcontainer/ghost_setup
npm install && npm start
