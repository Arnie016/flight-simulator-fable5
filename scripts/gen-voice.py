#!/usr/bin/env python3
"""
Pre-generate the flight instructor's voice lines with Deepgram TTS.

The key is used ONLY here, at build time, and never ships to the public site.
Output: ../voice/<slug>.mp3 for each line + ../voice/manifest.json

Usage:
    export DEEPGRAM_API_KEY=xxxxxxxx        # your YC Deepgram key
    python3 scripts/gen-voice.py            # from the repo root
    # optional: DEEPGRAM_MODEL=aura-2-andromeda-en python3 scripts/gen-voice.py

Then commit the voice/ folder and push — done.
"""
import json, os, re, sys, urllib.request, urllib.error, pathlib

KEY = os.environ.get("DEEPGRAM_API_KEY")
MODEL = os.environ.get("DEEPGRAM_MODEL", "aura-2-andromeda-en")  # calm, professional en voice
if not KEY:
    sys.exit("Set DEEPGRAM_API_KEY first:  export DEEPGRAM_API_KEY=...")

ROOT = pathlib.Path(__file__).resolve().parent.parent
OUT = ROOT / "voice"
OUT.mkdir(exist_ok=True)
lines = json.loads((ROOT / "scripts" / "lines.json").read_text())

def slug(t):  # MUST match voiceSlug() in index.html exactly
    return re.sub(r'^-|-$', '', re.sub(r'[^a-z0-9]+', '-', t.lower()))[:48]

url = f"https://api.deepgram.com/v1/speak?model={MODEL}&encoding=mp3"
slugs, ok, fail = [], 0, 0
for text in lines:
    s = slug(text)
    body = json.dumps({"text": text}).encode()
    req = urllib.request.Request(url, data=body, method="POST", headers={
        "Authorization": f"Token {KEY}", "Content-Type": "application/json"})
    try:
        with urllib.request.urlopen(req, timeout=30) as r:
            audio = r.read()
        (OUT / f"{s}.mp3").write_bytes(audio)
        slugs.append(s); ok += 1
        print(f"  ok   {s}.mp3  ({len(audio)//1024} KB)")
    except urllib.error.HTTPError as e:
        fail += 1
        print(f"  FAIL {s}: HTTP {e.code} {e.read().decode()[:120]}", file=sys.stderr)
    except Exception as e:
        fail += 1
        print(f"  FAIL {s}: {e}", file=sys.stderr)

(OUT / "manifest.json").write_text(json.dumps({"model": MODEL, "slugs": slugs}, indent=1))
print(f"\n{ok} clips written to {OUT}, {fail} failed. Manifest updated.")
if fail == 0:
    print("Now:  git add voice && git commit -m 'Add Deepgram instructor voice' && git push")
