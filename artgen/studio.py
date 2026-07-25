#!/usr/bin/env python3
"""
GrimForge Studio  -  a little local control panel for cooking up art.

Serves a web UI at http://localhost:7861 that talks to your running ComfyUI
(Mountain Tech Image Studio). Flip switches -- model, style, subject, size --
hit Generate, see the result. No prompt-relaying through chat.

Run ComfyUI first (Mountain-Tech-ImageGen.bat), then:  python studio.py
Pure Python stdlib. Local-only (127.0.0.1).
"""
import json, urllib.request, urllib.parse, time, os, random
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

COMFY = "127.0.0.1:8188"
HERE  = os.path.dirname(os.path.abspath(__file__))
OUT   = os.path.join(HERE, "out")
PROFILES_FILE = os.path.join(HERE, "profiles.json")
PORT  = 7861

def load_profiles():
    try:
        with open(PROFILES_FILE, encoding="utf-8") as f: return json.load(f)
    except Exception:
        return {}
def save_profiles(p):
    with open(PROFILES_FILE, "w", encoding="utf-8") as f: json.dump(p, f, indent=2)

def cpost(path, data):
    req = urllib.request.Request("http://"+COMFY+path, data=json.dumps(data).encode(),
        headers={"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))
def cget(path):
    return json.load(urllib.request.urlopen("http://"+COMFY+path, timeout=30))

def list_models():
    try:
        c = cget("/object_info/CheckpointLoaderSimple")
        return c["CheckpointLoaderSimple"]["input"]["required"]["ckpt_name"][0]
    except Exception:
        return []

def build_graph(p):
    return {
      "4":{"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":p["model"]}},
      "6":{"class_type":"CLIPTextEncode","inputs":{"text":p["prompt"],"clip":["4",1]}},
      "7":{"class_type":"CLIPTextEncode","inputs":{"text":p["negative"],"clip":["4",1]}},
      "5":{"class_type":"EmptyLatentImage","inputs":{"width":p["width"],"height":p["height"],"batch_size":1}},
      "3":{"class_type":"KSampler","inputs":{"seed":p["seed"],"steps":p["steps"],"cfg":p["cfg"],
            "sampler_name":"dpmpp_2m","scheduler":"karras","denoise":1.0,
            "model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["5",0]}},
      "8":{"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},
      "9":{"class_type":"SaveImage","inputs":{"filename_prefix":"grimforge/"+p.get("name","gen"),"images":["8",0]}},
    }

def generate(p):
    os.makedirs(OUT, exist_ok=True)
    r = cpost("/prompt", {"prompt": build_graph(p)})
    pid = r["prompt_id"]
    for _ in range(900):
        try: hist = cget("/history/"+pid)
        except Exception: hist = {}
        if pid in hist and hist[pid].get("outputs"):
            for node in hist[pid]["outputs"].values():
                for im in node.get("images", []):
                    q = urllib.parse.urlencode({"filename":im["filename"],
                        "subfolder":im.get("subfolder",""), "type":im.get("type","output")})
                    data = urllib.request.urlopen("http://"+COMFY+"/view?"+q, timeout=60).read()
                    with open(os.path.join(OUT, im["filename"]), "wb") as f: f.write(data)
                    return im["filename"]
            return None
        time.sleep(1)
    return None

PAGE = """<!DOCTYPE html><html lang=en><head><meta charset=UTF-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>GrimForge Studio</title>
<link href="https://fonts.googleapis.com/css2?family=Press+Start+2P&family=VT323&display=swap" rel=stylesheet>
<style>
:root{--gold:#e8b24c;--gold2:#f6d785;--rune:#5fe0d6;--ink:#0b0a14;--parch:#e9dcc3;--ring:rgba(232,178,76,.5)}
*{box-sizing:border-box}body{margin:0;background:#0b0a14;color:var(--parch);font-family:VT323,monospace;font-size:1.25rem}
header{padding:.8rem 1.2rem;border-bottom:1px solid var(--ring);display:flex;align-items:center;gap:.6rem}
header h1{font-family:'Press Start 2P',monospace;font-size:1rem;color:var(--gold2);margin:0;text-shadow:0 0 12px rgba(232,178,76,.5)}
header .st{margin-left:auto;font-size:1rem;color:#8a7} header .st.bad{color:#e66}
.wrap{display:flex;gap:1rem;padding:1rem;flex-wrap:wrap}
.panel{flex:1 1 320px;min-width:300px;background:linear-gradient(160deg,rgba(31,22,13,.7),rgba(11,10,20,.7));
  border:1px solid var(--ring);border-radius:12px;padding:1rem}
.stage{flex:2 1 420px;min-width:320px;display:flex;flex-direction:column;gap:.7rem;align-items:center}
label{display:block;font-size:1rem;letter-spacing:.05em;text-transform:uppercase;color:var(--rune);margin:.7rem 0 .2rem}
select,input,textarea,button{width:100%;font-family:VT323,monospace;font-size:1.15rem;background:rgba(0,0,0,.35);
  color:var(--parch);border:1px solid var(--ring);border-radius:8px;padding:.5rem .6rem}
textarea{resize:vertical;min-height:74px;line-height:1.25}
.row{display:flex;gap:.5rem}.row>*{flex:1}
.chips{display:flex;gap:.4rem;flex-wrap:wrap}
.chip{width:auto;cursor:pointer;padding:.35rem .7rem;background:rgba(232,178,76,.08)}
.chip.on{background:var(--gold);color:#1a1207;font-weight:bold}
.gen{margin-top:1rem;font-family:'Press Start 2P',monospace;font-size:.8rem;color:#1a1207;cursor:pointer;
  background:linear-gradient(180deg,var(--gold2),var(--gold));border:none;padding:.9rem;box-shadow:0 0 20px rgba(232,178,76,.4)}
.gen:disabled{opacity:.5;cursor:wait}
.result{width:100%;max-width:460px;border:1px solid var(--ring);border-radius:12px;background:rgba(0,0,0,.3);
  min-height:260px;display:flex;align-items:center;justify-content:center;overflow:hidden}
.result img{width:100%;display:block;image-rendering:auto}
.muted{color:#9a8a70;font-size:1rem}
.gallery{display:flex;gap:.5rem;flex-wrap:wrap;justify-content:center}
.gallery img{width:64px;height:64px;object-fit:cover;border:1px solid var(--ring);border-radius:6px;cursor:pointer}
.spin{color:var(--gold2)}
small{color:#8a7a60}
</style></head><body>
<header><h1>&#9878; GrimForge Studio</h1><span class=st id=status>checking ComfyUI...</span></header>
<div class=wrap>
  <div class=panel>
    <label>Model (checkpoint)</label>
    <select id=model></select>
    <small id=modelhint></small>

    <label>Profile</label>
    <select id=profile></select>
    <div class=chips style="margin-top:.4rem">
      <button class=chip id=pload>Load</button>
      <button class=chip id=psave>Save as&hellip;</button>
      <button class=chip id=pdel>Delete</button>
    </div>

    <label>Style</label>
    <div class=chips id=styles>
      <button class="chip on" data-s=cyberfantasy>Fantasy-Cyber</button>
      <button class=chip data-s=anime>Anime</button>
      <button class=chip data-s=semireal>Semi-real</button>
      <button class=chip data-s=real>Realistic</button>
      <button class=chip data-s=paint>Painterly</button>
    </div>

    <label>What are you making</label>
    <div class=chips id=subjects>
      <button class="chip on" data-j=character>Character</button>
      <button class=chip data-j=npc>NPC</button>
      <button class=chip data-j=scene>Scene BG</button>
      <button class=chip data-j=building>Building</button>
      <button class=chip data-j=icon>Icon</button>
      <button class=chip data-j=logo>Logo</button>
      <button class=chip data-j=tile>Tile</button>
      <button class=chip data-j=custom>Custom</button>
    </div>

    <label style="display:flex;align-items:center;justify-content:space-between">Prompt
      <button class=chip id=opt style="text-transform:none;font-size:.95rem">&#128161; Optimize</button></label>
    <textarea id=prompt></textarea>
    <label>Negative</label>
    <textarea id=negative></textarea>

    <div class=row>
      <div><label>Size</label>
        <select id=size>
          <option value="832x1216">Portrait</option>
          <option value="1216x832">Landscape / BG</option>
          <option value="1024x1024">Square</option>
          <option value="512x512">Tile 512</option>
          <option value="640x896">Tall sprite</option>
        </select></div>
      <div><label>Steps</label><input id=steps type=number value=28 min=8 max=60></div>
      <div><label>CFG</label><input id=cfg type=number value=5.5 step=.5 min=1 max=12></div>
    </div>
    <div class=row>
      <div><label>Seed (blank = random)</label><input id=seed placeholder="random"></div>
      <div><label>Batch</label><select id=batch><option>1</option><option>2</option><option>4</option></select></div>
    </div>
    <button class=gen id=go>&#9874; COOK IT</button>
  </div>

  <div class=stage>
    <div class=result id=result><span class=muted>Your creation shows up here.</span></div>
    <div id=meta class=muted></div>
    <label style="align-self:flex-start">This session</label>
    <div class=gallery id=gallery></div>
  </div>
</div>
<script>
const STYLES={
  cyberfantasy:{p:"masterpiece, best quality, high fantasy foundation, ancient arcane technology, divine runework, glowing sigils fused into ornate metal and carved stone, magic-as-technology, intricate layered detail, ornate, mythic, gold and teal rune-light, atmospheric depth, ",n:"worst quality, low quality, cyberpunk city, neon signs, plastic, cheap sci-fi, flat, simple, minimalist, "},
  anime:{p:"masterpiece, best quality, (anime style:1.4), cel shading, flat color, 2d illustration, ",n:"(realistic:1.4), photorealistic, 3d, photograph, "},
  semireal:{p:"masterpiece, best quality, semi-realistic, painterly, detailed, ",n:""},
  real:{p:"masterpiece, best quality, photorealistic, detailed skin, cinematic lighting, ",n:""},
  paint:{p:"masterpiece, best quality, painterly, digital painting, concept art, ",n:"photorealistic, "}
};
const PRESETS={
  character:{size:"832x1216",p:"1boy, solo, mature rugged mountain man, very long ginger red hair, thick red beard, green eyes, red plaid flannel shirt, upper body portrait"},
  npc:{size:"832x1216",p:"1boy, male, solo, rugged fantasy blacksmith, masculine, muscular, thick beard, upper body portrait, forge background, detailed"},
  scene:{size:"1216x832",p:"wide establishing shot, atmospheric environment, scenery, no characters, dramatic depth and lighting"},
  building:{size:"1024x1024",p:"a fantasy building, isometric video-game asset, isolated on plain dark background, centered, detailed"},
  icon:{size:"1024x1024",p:"single game UI icon, isolated on plain dark background, centered, clean bold silhouette, simple, iconic"},
  logo:{size:"1024x1024",p:"emblem logo mark, iconic, isolated on plain dark background, centered, symmetrical, clean vector-like design"},
  tile:{size:"512x512",p:"seamless tileable ground texture, top-down, game asset, no characters"},
  custom:{size:"832x1216",p:""}
};
const BASE_NEG="worst quality, low quality, lowres, blurry, bad anatomy, bad hands, extra fingers, deformed, watermark, signature, text, 1girl, female, child";
let style="cyberfantasy", subject="character";
const $=id=>document.getElementById(id);

function rebuild(){
  const pr=PRESETS[subject]||{p:"",size:null};
  $("prompt").value = STYLES[style].p + pr.p;
  $("negative").value = (STYLES[style].n||"") + BASE_NEG;
  if(pr.size) $("size").value = pr.size;
}
function chips(box,attr,cur,set){
  box.querySelectorAll(".chip").forEach(b=>b.addEventListener("click",()=>{
    box.querySelectorAll(".chip").forEach(x=>x.classList.remove("on"));
    b.classList.add("on"); set(b.dataset[attr]); rebuild();
  }));
}
chips($("styles"),"s",style,v=>style=v);
chips($("subjects"),"j",subject,v=>subject=v);

// tricks-based prompt optimizer: turns a plain idea into a structured, model-friendly prompt
function optimize(){
  const raw=$("prompt").value.trim(); if(!raw) return;
  const userTerms=raw.split(",").map(s=>s.trim()).filter(Boolean);
  const lower=raw.toLowerCase(), has=w=>lower.includes(w);
  const front=[], back=[];
  if(!has("masterpiece")&&!has("best quality")) front.push("masterpiece","best quality","amazing quality");
  if(!has("detail")) back.push("highly detailed","intricate detail");
  if(!has("focus")) back.push("sharp focus");
  if(subject==="character"||subject==="npc"){ if(!has("face")) back.push("detailed face","expressive eyes"); if(!has("light")) back.push("cinematic rim lighting"); }
  else if(subject==="scene"){ if(!has("atmospher")) back.push("atmospheric","volumetric light"); if(!has("depth")) back.push("sense of depth"); }
  else if(subject==="icon"||subject==="logo"){ if(!has("background")) back.push("isolated on plain dark background","centered"); back.push("clean bold silhouette"); }
  const sw=({cyberfantasy:["glowing runes","arcane circuitry","neon teal and gold"],anime:["anime style","cel shading"],real:["photorealistic","cinematic lighting"],semireal:["semi-realistic","painterly"],paint:["digital painting","concept art"]})[style]||[];
  sw.forEach(t=>{ if(!has(t.split(" ")[0])) back.push(t); });
  const seen=new Set(), out=[];
  [...front,...userTerms,...back].forEach(t=>{ const k=t.toLowerCase(); if(t&&!seen.has(k)){ seen.add(k); out.push(t); } });
  $("prompt").value=out.join(", ");
  if(!$("negative").value.trim()) $("negative").value=BASE_NEG;
}
$("opt").addEventListener("click",optimize);

fetch("/api/models").then(r=>r.json()).then(list=>{
  const sel=$("model");
  if(!list.length){ $("status").textContent="ComfyUI not reachable"; $("status").classList.add("bad");
    $("modelhint").textContent="Start Mountain-Tech-ImageGen.bat, then refresh."; return; }
  $("status").textContent="ComfyUI ✓";
  list.forEach(m=>{const o=document.createElement("option");o.value=m;o.textContent=m;sel.appendChild(o);});
  const anime=list.find(m=>/illustrious|anime|noob|pony/i.test(m));
  if(anime) sel.value=anime;
  $("modelhint").textContent = anime? "Anime-ish model auto-picked. For TRUE cel anime, add a pure Illustrious/NoobAI checkpoint." : "Tip: add an Illustrious/NoobAI checkpoint for real anime.";
});

rebuild();

function getFields(){ return {style,subject,model:$("model").value,prompt:$("prompt").value,negative:$("negative").value,size:$("size").value,steps:$("steps").value,cfg:$("cfg").value}; }
function setChip(box,attr,val){ box.querySelectorAll(".chip").forEach(x=>x.classList.toggle("on",x.dataset[attr]===val)); }
function setFields(d){ if(!d)return;
  if(d.style){style=d.style;setChip($("styles"),"s",d.style);}
  if(d.subject){subject=d.subject;setChip($("subjects"),"j",d.subject);}
  if(d.model && [...$("model").options].some(o=>o.value===d.model)) $("model").value=d.model;
  $("prompt").value=d.prompt||""; $("negative").value=d.negative||"";
  if(d.size)$("size").value=d.size; if(d.steps)$("steps").value=d.steps; if(d.cfg)$("cfg").value=d.cfg; }

let PROFS={};
function loadProfiles(){ fetch("/api/profiles").then(r=>r.json()).then(p=>{ PROFS=p; const sel=$("profile"); sel.innerHTML="";
  const keys=Object.keys(p);
  if(!keys.length){ const o=document.createElement("option"); o.value=""; o.textContent="(no saved profiles yet)"; sel.appendChild(o); }
  keys.forEach(n=>{const o=document.createElement("option");o.value=n;o.textContent=n;sel.appendChild(o);}); }); }
$("pload").onclick=()=>{ const n=$("profile").value; if(n&&PROFS[n]) setFields(PROFS[n]); };
$("psave").onclick=()=>{ const n=prompt("Save this setup as:"); if(!n)return;
  fetch("/api/profiles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"save",name:n,data:getFields()})})
    .then(r=>r.json()).then(d=>{PROFS=d.profiles;loadProfiles();setTimeout(()=>{$("profile").value=n;},50);}); };
$("pdel").onclick=()=>{ const n=$("profile").value; if(!n)return;
  fetch("/api/profiles",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({op:"delete",name:n})})
    .then(r=>r.json()).then(d=>{PROFS=d.profiles;loadProfiles();}); };
loadProfiles();

async function cook(){
  const n=+$("batch").value||1, [w,h]=$("size").value.split("x").map(Number);
  $("go").disabled=true; $("meta").textContent="";
  for(let i=0;i<n;i++){
    $("result").innerHTML='<span class=spin>&#9878; forging '+(i+1)+'/'+n+'... (first one after launch is slow)</span>';
    const body={model:$("model").value,prompt:$("prompt").value,negative:$("negative").value,
      width:w,height:h,steps:+$("steps").value,cfg:+$("cfg").value,
      seed:(n===1&&$("seed").value.trim())?+$("seed").value:null,name:subject};
    try{
      const d=await (await fetch("/api/generate",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)})).json();
      if(!d.ok){ $("result").innerHTML='<span class=muted>'+(d.error||"failed")+'</span>'; break; }
      const url=d.url+"?t="+Date.now();
      $("result").innerHTML='<img src="'+url+'">';
      $("meta").innerHTML="seed "+d.seed+" &nbsp;&middot;&nbsp; <a style='color:var(--gold2)' href='"+d.url+"' download>download</a>";
      const g=document.createElement("img"); g.src=url; g.title="seed "+d.seed; const u=url;
      g.onclick=()=>$("result").innerHTML='<img src="'+u+'">';
      $("gallery").prepend(g);
    }catch(e){ $("result").innerHTML='<span class=muted>error: '+e+'</span>'; break; }
  }
  $("go").disabled=false;
}
$("go").addEventListener("click",cook);
</script></body></html>"""

class H(BaseHTTPRequestHandler):
    # security: only Cody's own pages may call this local tool — no random site can.
    ALLOW = {"http://localhost:8080","http://127.0.0.1:8080","http://localhost:7861",
             "http://127.0.0.1:7861","https://desktop-gkvskaf.tail73d7db.ts.net:10000"}
    def _cors(self):
        o = self.headers.get("Origin","")
        if o in self.ALLOW:
            self.send_header("Access-Control-Allow-Origin", o)
            self.send_header("Access-Control-Allow-Headers", "Content-Type")
    def _send(self, code, ctype, body):
        self.send_response(code); self.send_header("Content-Type", ctype); self._cors()
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)
    def do_OPTIONS(self):
        self.send_response(204); self._cors()
        self.send_header("Access-Control-Allow-Methods","GET, POST, OPTIONS"); self.end_headers()
    def do_GET(self):
        if self.path == "/" or self.path.startswith("/?") or self.path.startswith("/index"):
            self._send(200, "text/html; charset=utf-8", PAGE.encode("utf-8"))
        elif self.path == "/api/models":
            self._send(200, "application/json", json.dumps(list_models()).encode())
        elif self.path == "/api/profiles":
            self._send(200, "application/json", json.dumps(load_profiles()).encode())
        elif self.path.startswith("/out/"):
            fn = os.path.join(OUT, os.path.basename(self.path[5:].split("?")[0]))
            if os.path.exists(fn):
                with open(fn, "rb") as f: self._send(200, "image/png", f.read())
            else: self._send(404, "text/plain", b"not found")
        else:
            self._send(404, "text/plain", b"not found")
    def do_POST(self):
        if self.path == "/api/generate":
            n = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(n) or b"{}")
            p = {"model":body.get("model"), "prompt":body.get("prompt",""), "negative":body.get("negative",""),
                 "width":int(body.get("width",832)), "height":int(body.get("height",1216)),
                 "steps":int(body.get("steps",28)), "cfg":float(body.get("cfg",5.5)),
                 "seed":int(body.get("seed") or random.randint(0,2**31-1)), "name":body.get("name","gen")}
            try:
                fn = generate(p)
                out = {"ok":True,"url":"/out/"+fn,"seed":p["seed"]} if fn else {"ok":False,"error":"timeout / no image"}
            except Exception as e:
                out = {"ok":False,"error":str(e)}
            self._send(200, "application/json", json.dumps(out).encode())
        elif self.path == "/api/profiles":
            n = int(self.headers.get("Content-Length", 0))
            body = json.loads(self.rfile.read(n) or b"{}")
            profs = load_profiles()
            if body.get("op") == "delete":
                profs.pop(body.get("name"), None)
            elif body.get("name"):
                profs[body["name"]] = body.get("data", {})
            save_profiles(profs)
            self._send(200, "application/json", json.dumps({"ok":True,"profiles":profs}).encode())
        else:
            self._send(404, "text/plain", b"not found")
    def log_message(self, *a): pass

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("GrimForge Studio  ->  http://localhost:%d" % PORT)
    print("(ComfyUI / Image Studio must be running at %s)" % COMFY)
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
