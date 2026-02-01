#!/bin/bash
# Clear Electron cache
echo "Clearing Electron cache..."
rm -rf ~/Library/Application\ Support/boring-browser
rm -rf ~/Library/Caches/boring-browser
echo "Cache cleared!"
echo "Now run: npm start"
