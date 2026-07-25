#!/usr/bin/env python3
"""
comfy_gen.py  -  GrimForge anime-asset generator.

Talks straight to a running ComfyUI (Mountain Tech Image Studio) HTTP API --
no saved workflow file needed. Builds an SDXL txt2img graph, queues it, waits,
and downloads the result to ./out/.  Pure Python stdlib (urllib/json).

Prereq: launch  C:\\ImageStudio\\ComfyUI-Zluda\\Mountain-Tech-ImageGen.bat
        so the API is live at 127.0.0.1:8188.

Usage:
    python comfy_gen.py                 # -> Cody anime portrait (default)
    python comfy_gen.py <name> "<positive prompt>" ["<negative>"]
"""
import json, urllib.request, urllib.parse, time, os, sys, random

SERVER = "127.0.0.1:8188"
MODEL  = os.environ.get("COMFY_MODEL", "realismIllustriousBy_v55FP16.safetensors")  # override via $env:COMFY_MODEL
OUT    = os.path.join(os.path.dirname(os.path.abspath(__file__)), "out")

def post(path, data):
    req = urllib.request.Request("http://"+SERVER+path,
        data=json.dumps(data).encode("utf-8"),
        headers={"Content-Type": "application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))

def get(path):
    return json.load(urllib.request.urlopen("http://"+SERVER+path, timeout=30))

def graph(pos, neg, seed, w, h, prefix):
    return {
      "4": {"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":MODEL}},
      "6": {"class_type":"CLIPTextEncode","inputs":{"text":pos,"clip":["4",1]}},
      "7": {"class_type":"CLIPTextEncode","inputs":{"text":neg,"clip":["4",1]}},
      "5": {"class_type":"EmptyLatentImage","inputs":{"width":w,"height":h,"batch_size":1}},
      "3": {"class_type":"KSampler","inputs":{"seed":seed,"steps":28,"cfg":5.5,
            "sampler_name":"dpmpp_2m","scheduler":"karras","denoise":1.0,
            "model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},
      "8": {"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},
      "9": {"class_type":"SaveImage","inputs":{"filename_prefix":prefix,"images":["8",0]}},
    }

def generate(name, pos, neg, seed=None, w=832, h=1216):
    seed = seed if seed is not None else random.randint(0, 2**31-1)
    print("Queuing '%s'  (seed %d, %dx%d) ..." % (name, seed, w, h)); sys.stdout.flush()
    r = post("/prompt", {"prompt": graph(pos, neg, seed, w, h, "grimforge/"+name)})
    pid = r["prompt_id"]
    os.makedirs(OUT, exist_ok=True)
    for i in range(900):                       # up to ~15 min (ZLUDA first gen is slow)
        try:
            hist = get("/history/"+pid)
        except Exception:
            hist = {}
        if pid in hist and hist[pid].get("outputs"):
            saved = []
            for node in hist[pid]["outputs"].values():
                for im in node.get("images", []):
                    q = urllib.parse.urlencode({"filename":im["filename"],
                        "subfolder":im.get("subfolder",""), "type":im.get("type","output")})
                    data = urllib.request.urlopen("http://"+SERVER+"/view?"+q, timeout=60).read()
                    fn = os.path.join(OUT, im["filename"])
                    with open(fn, "wb") as f: f.write(data)
                    saved.append(fn)
            print("DONE ->", saved); return saved
        time.sleep(1)
    print("Timed out waiting for the image."); return []

# ---- default: Cody, the ginger-in-flannel, as an anime portrait ----
CODY_POS = ("masterpiece, best quality, amazing quality, 1boy, solo, mature male, "
    "rugged mountain man, long wavy ginger red hair, thick well-groomed red beard, "
    "green eyes, red plaid flannel shirt, upper body portrait, confident slight smirk, "
    "warm rim lighting, blurry forest and mountain background, depth of field, "
    "highly detailed face, anime screencap style")
CODY_NEG = ("worst quality, low quality, lowres, blurry, bad anatomy, bad hands, "
    "extra fingers, deformed, watermark, signature, text, 1girl, female, child, monochrome")

if __name__ == "__main__":
    if len(sys.argv) >= 3:
        name = sys.argv[1]
        pos  = sys.argv[2]
        neg  = sys.argv[3] if len(sys.argv) > 3 else CODY_NEG
        generate(name, pos, neg)
    else:
        generate("cody_portrait", CODY_POS, CODY_NEG)
