#!/bin/bash
# ================================================================
#  GamerZ Arena — Game Integration Setup Script
#  Run this once from the gamerzArena directory to copy all
#  game JS files and assets from the multi-game source project.
# ================================================================

SRC="/Users/princeverma/Desktop/resume_invent_frontend/multi-game/games"
DST="/Users/princeverma/Desktop/gamerzArena/games"

echo "📦 Copying game JS files..."

cp "$SRC/brain-train/math-speed.js"      "$DST/brain-train/math-speed/math-speed.js"
cp "$SRC/brain-train/memory-match.js"    "$DST/brain-train/memory-match/memory-match.js"
cp "$SRC/brain-train/sequence-memory.js" "$DST/brain-train/sequence-memory/sequence-memory.js"
cp "$SRC/puzzle/tetris.js"               "$DST/puzzle/tetris/tetris.js"
cp "$SRC/puzzle/sliding-puzzle.js"       "$DST/puzzle/sliding-puzzle/sliding-puzzle.js"
cp "$SRC/shooting/space-dog.js"          "$DST/shooting/space-dog/space-dog.js"

echo "🖼️  Copying Space Dog assets..."
cp "$SRC/shooting/assets/comet.png"      "$DST/shooting/assets/comet.png"
cp "$SRC/shooting/assets/explosion.png"  "$DST/shooting/assets/explosion.png"
cp "$SRC/shooting/assets/dog.gif"        "$DST/shooting/assets/dog.gif"

echo "✅ All files copied!"
echo ""
echo "Game directories:"
ls "$DST/brain-train/" "$DST/puzzle/" "$DST/shooting/"
