#!/usr/bin/env python3
"""
transform_demo.py  -  the self-only AI photo-transform demo.

NOT wired into the public site yet. Local-only (127.0.0.1) on purpose, same as
studio.py - exposing this publicly is a separate, deliberate decision (Tailscale
funnel + a real kill switch review), not a default.

What it does: a visitor's own uploaded photo goes in, comes back with a subtle,
realistic identity shift - the goal is "could pass as a relative," not a fantasy
character render and not a totally different person. Plain img2img (moderate
denoise, photographic prompt) - NOT IPAdapter FaceID, which is installed in this
ComfyUI and was tried, but it's built to LOCK identity across a generation, which
fights against deliberately shifting it. NOT face-swap/identity-grafting either
(that's ReActor - also installed, deliberately not used here). Full back-and-forth
on why each approach got tried and dropped is in the ai-transform-demo vault note.

Hard safety gate: an NSFWGate node (custom_nodes/transform_demo_safety) sits
between VAEDecode and SaveImage in the ComfyUI graph - if flagged, the whole
generation fails and nothing is ever saved or served. Added after Cody flagged
the misuse risk directly (2026-08-06). Not a suggestion, load-bearing.

Guardrails baked in (per the GPU-abuse conversation):
  - ONE_JOB: a threading.Lock - only one generation in flight at a time, atomic
  - RATE_LIMIT: one job per IP per RATE_WINDOW seconds
  - small/fast preset only (fewer steps, capped resolution) - not full quality
  - KILL_SWITCH file: touch kill.on next to this script to stop accepting jobs
  - uploaded source image is deleted right after the render completes - nothing
    of the visitor's photo is kept
  - NSFWGate (above) - nothing flagged unsafe is ever saved or served

Prereq: launch ComfyUI-Zluda first (Mountain-Tech-ImageGen.bat), then:
    python transform_demo.py
Pure Python stdlib, no new dependencies - same pattern as studio.py / comfy_gen.py.
"""
import json, urllib.request, urllib.parse, time, os, random, uuid, threading
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

COMFY  = "127.0.0.1:8188"
HERE   = os.path.dirname(os.path.abspath(__file__))
OUT    = os.path.join(HERE, "out", "transform")
UPLOAD = os.path.join(HERE, "_upload_tmp")
KILL   = os.path.join(HERE, "kill.on")
PORT   = 7862

MODEL = os.environ.get("COMFY_MODEL", "realismIllustriousBy_v55FP16.safetensors")

# --- guardrails ---
MAX_SIDE      = 768        # small/fast preset - not full studio quality
STEPS         = 20         # fewer steps than the full studio's 28
SUBTLE_DENOISE = 0.4       # first guess for "subtle, could pass as a relative" - not yet
                            # tuned against a real test. 0.55 on the old fantasy prompt was
                            # too little change, 0.7 was too much (different person entirely) -
                            # this needs its own real test, not just reused numbers.
RATE_WINDOW   = 300        # seconds between jobs, per IP
_last_by_ip   = {}
_job_lock     = threading.Lock()   # atomic - a plain bool here let two near-simultaneous
                                    # requests both slip past the check before either set it,
                                    # which sent two generations onto the GPU at once and
                                    # caused a catastrophic VRAM-offload slowdown (2026-08-06)
JOBS          = {}         # job_id -> {"status": running|done|error, "url":..., "error":...}

def killed():
    return os.path.exists(KILL)

def parse_multipart_photo(content_type, body):
    """Pure-stdlib multipart/form-data parsing - the cgi module is gone in Python 3.13."""
    if 'boundary=' not in content_type:
        raise ValueError("no boundary in Content-Type")
    boundary = content_type.split('boundary=')[1].strip().strip('"').encode()
    for part in body.split(b'--' + boundary):
        part = part.strip(b'\r\n')
        if not part or part == b'--':
            continue
        if b'\r\n\r\n' not in part:
            continue
        head, data = part.split(b'\r\n\r\n', 1)
        if b'name="photo"' in head:
            return data.rstrip(b'\r\n')
    raise ValueError("no photo field found")

def cpost(path, data):
    req = urllib.request.Request("http://"+COMFY+path, data=json.dumps(data).encode(),
        headers={"Content-Type":"application/json"})
    return json.load(urllib.request.urlopen(req, timeout=30))
def cget(path):
    return json.load(urllib.request.urlopen("http://"+COMFY+path, timeout=30))

def free_comfy_memory():
    """Force ComfyUI to fully unload models before the next job. Without this, every
    generation after the first in a session loads the checkpoint "partially" (mostly
    offloaded to CPU) even with VRAM free - a ZLUDA memory-accounting quirk that showed
    up specifically with img2img (VAEEncode), not the txt2img-only tools. Confirmed fix
    2026-08-06: calling this before generating turned a 170s/step CPU-offload disaster
    back into a normal ~2.6s/step GPU run."""
    req = urllib.request.Request("http://"+COMFY+"/free",
        data=json.dumps({"unload_models": True, "free_memory": True}).encode(),
        headers={"Content-Type":"application/json"})
    urllib.request.urlopen(req, timeout=15)

def upload_to_comfy(local_path):
    """Push the visitor's photo into ComfyUI's own input folder via its upload API."""
    boundary = uuid.uuid4().hex
    with open(local_path, "rb") as f:
        data = f.read()
    body = (
        ("--%s\r\n" % boundary).encode() +
        b'Content-Disposition: form-data; name="image"; filename="upload.png"\r\n'
        b"Content-Type: image/png\r\n\r\n" + data + b"\r\n" +
        ("--%s--\r\n" % boundary).encode()
    )
    req = urllib.request.Request("http://"+COMFY+"/upload/image", data=body,
        headers={"Content-Type": "multipart/form-data; boundary=" + boundary})
    resp = json.load(urllib.request.urlopen(req, timeout=30))
    return resp["name"]  # filename ComfyUI now knows about

def build_graph(comfy_filename, prompt, negative, seed, w, h):
    """Pivoted 2026-08-06: the actual goal is a REALISTIC, SUBTLE identity shift
    ("could pass as a relative"), not a fantasy character. IPAdapter FaceID is the
    wrong tool for this specifically - it's built to LOCK identity across a
    generation, which fights against deliberately shifting it. Plain img2img
    (moderate denoise, photographic prompt, no fantasy elements) is the right tool
    here - see the ai-transform-demo vault note for the full back-and-forth.

    NSFWGate sits between VAEDecode and SaveImage - if the output is flagged, this
    raises, the whole prompt fails, and SaveImage never runs. Nothing unsafe is
    ever written to disk or served. Added after Cody flagged the misuse risk
    directly (2026-08-06) - a real, load-bearing gate, not a suggestion."""
    return {
      "4":  {"class_type":"CheckpointLoaderSimple","inputs":{"ckpt_name":MODEL}},
      "10": {"class_type":"LoadImage","inputs":{"image":comfy_filename}},
      "11": {"class_type":"VAEEncode","inputs":{"pixels":["10",0],"vae":["4",2]}},
      "6":  {"class_type":"CLIPTextEncode","inputs":{"text":prompt,"clip":["4",1]}},
      "7":  {"class_type":"CLIPTextEncode","inputs":{"text":negative,"clip":["4",1]}},
      "3":  {"class_type":"KSampler","inputs":{"seed":seed,"steps":STEPS,"cfg":5.5,
              "sampler_name":"dpmpp_2m","scheduler":"karras","denoise":SUBTLE_DENOISE,
              "model":["4",0],"positive":["6",0],"negative":["7",0],"latent_image":["11",0]}},
      "8":  {"class_type":"VAEDecode","inputs":{"samples":["3",0],"vae":["4",2]}},
      "12": {"class_type":"NSFWGate","inputs":{"image":["8",0]}},
      "9":  {"class_type":"SaveImage","inputs":{"filename_prefix":"transform_demo/out","images":["12",0]}},
    }

def generate(comfy_filename, prompt, negative, w, h):
    os.makedirs(OUT, exist_ok=True)
    try:
        free_comfy_memory()
    except Exception:
        pass  # best-effort - if this fails, the job still tries, just risks the slow path
    seed = random.randint(0, 2**31 - 1)
    r = cpost("/prompt", {"prompt": build_graph(comfy_filename, prompt, negative, seed, w, h)})
    pid = r["prompt_id"]
    for _ in range(300):  # ~5 min cap - small preset should be much faster than that
        try: hist = cget("/history/"+pid)
        except Exception: hist = {}
        if pid in hist:
            status = hist[pid].get("status", {})
            if status.get("status_str") == "error":
                # fails fast (this one took 6.7s) - used to sit here for the full 5-minute
                # timeout because only success was checked for, not failure (2026-08-06)
                msgs = status.get("messages", [])
                detail = next((m[1].get("exception_message") for m in msgs if m[0] == "execution_error"), "generation failed")
                raise RuntimeError(detail)
            if hist[pid].get("outputs"):
                for node in hist[pid]["outputs"].values():
                    for im in node.get("images", []):
                        q = urllib.parse.urlencode({"filename":im["filename"],
                            "subfolder":im.get("subfolder",""), "type":im.get("type","output")})
                        data = urllib.request.urlopen("http://"+COMFY+"/view?"+q, timeout=60).read()
                        fn = os.path.join(OUT, im["filename"])
                        with open(fn, "wb") as f: f.write(data)
                        return fn
                return None
        time.sleep(1)
    return None

def run_job(job_id, photo_bytes):
    """Runs in a background thread so the HTTP response returns immediately - a
    client on a flaky mobile connection polls /api/status instead of holding one
    long connection open for the whole generation (that's what dropped the first
    real test: the phone's connection got aborted mid-wait, after the render had
    already finished server-side)."""
    os.makedirs(UPLOAD, exist_ok=True)
    local_path = os.path.join(UPLOAD, uuid.uuid4().hex + ".png")
    try:
        with open(local_path, "wb") as f: f.write(photo_bytes)
        comfy_name = upload_to_comfy(local_path)
        # Realistic, not fantasy - the point is a believable subtle identity shift,
        # not a character render. See ai-transform-demo vault note, 2026-08-06.
        prompt = ("a realistic photo portrait, natural lighting, candid, photographic detail, "
                  "same setting and clothing, subtly different facial features")
        negative = ("worst quality, low quality, blurry, watermark, text, deformed face, "
                     "fantasy, armor, cartoon, illustration, painting, "
                     "nsfw, nude, naked, sexual, explicit, underwear, lingerie, child, minor")
        out_fn = generate(comfy_name, prompt, negative, MAX_SIDE, MAX_SIDE)
        if out_fn:
            JOBS[job_id] = {"status":"done", "url":"/out/"+os.path.basename(out_fn), "error":None}
        else:
            print("[job %s] FAILED: timed out waiting on ComfyUI (no error, no output - check if it's stuck offloaded to CPU)" % job_id, flush=True)
            JOBS[job_id] = {"status":"error", "url":None, "error":"timeout / no image"}
    except Exception as e:
        print("[job %s] FAILED: %r" % (job_id, e), flush=True)  # so this is visible in the log, not just swallowed
        JOBS[job_id] = {"status":"error", "url":None, "error":str(e)}
    finally:
        if os.path.exists(local_path):
            os.remove(local_path)  # nothing of the visitor's photo sticks around
        _job_lock.release()

PAGE = """<!DOCTYPE html><html lang=en><head><meta charset=UTF-8>
<meta name=viewport content="width=device-width,initial-scale=1">
<title>AI Transform - self demo (local test)</title>
<style>
body{font-family:system-ui;background:#0b0a14;color:#e9dcc3;max-width:560px;margin:2rem auto;padding:0 1rem}
h1{color:#e8b24c;font-size:1.3rem}
.warn{background:rgba(232,178,76,.1);border:1px solid rgba(232,178,76,.4);border-radius:10px;padding:.8rem 1rem;font-size:.92rem;line-height:1.5;margin:1rem 0}
input,button{width:100%;padding:.6rem;margin-top:.6rem;font-size:1rem}
#out{margin-top:1rem;max-width:100%}
#status{color:#8a7a60}
</style></head><body>
<h1>&#9878; AI Transform - local test only</h1>
<div class=warn><b>Good AI stops you from misusing this. Bad AI won't.</b> This only ever
transforms YOUR OWN uploaded photo - never anyone else's, ever. Nothing is saved after
your result renders. This test page is not on the public site yet.</div>
<p style="margin:0;font-size:.9rem;color:#8a7a60">Take a photo now, or pick one you already have.</p>
<input type=file id=f accept="image/*" capture="user">
<button id=go>Transform it</button>
<div id=status></div>
<img id=out>
<script>
document.getElementById('go').onclick = async () => {
  const file = document.getElementById('f').files[0];
  if (!file) return;
  const status = document.getElementById('status');
  const btn = document.getElementById('go');
  btn.disabled = true;
  status.textContent = 'uploading...';
  const fd = new FormData(); fd.append('photo', file);
  let d;
  try {
    const r = await fetch('/api/transform', {method:'POST', body: fd});
    d = await r.json();
  } catch (e) { status.textContent = 'upload failed - check your connection and try again'; btn.disabled = false; return; }
  if (!d.ok) { status.textContent = 'error: ' + (d.error || 'unknown'); btn.disabled = false; return; }

  let elapsed = 0;
  status.textContent = 'forging... 0s (can take a minute or two - keep this tab open, it keeps checking on its own)';
  const iv = setInterval(async () => {
    elapsed += 3;
    try {
      const sr = await fetch('/api/status/' + d.job);
      const sd = await sr.json();
      if (sd.status === 'done') {
        clearInterval(iv); btn.disabled = false;
        document.getElementById('out').src = sd.url + '?t=' + Date.now();
        status.textContent = 'done (' + elapsed + 's)';
      } else if (sd.status === 'error') {
        clearInterval(iv); btn.disabled = false;
        status.textContent = 'error: ' + sd.error;
      } else {
        status.textContent = 'forging... ' + elapsed + 's';
      }
    } catch (e) { /* one dropped poll is fine - the next one 3s later picks it back up */ }
  }, 3000);
};
</script></body></html>"""

class H(BaseHTTPRequestHandler):
    def _send(self, code, ctype, body):
        self.send_response(code); self.send_header("Content-Type", ctype)
        self.send_header("Content-Length", str(len(body))); self.end_headers(); self.wfile.write(body)

    def do_GET(self):
        if self.path in ("/", "/index.html"):
            self._send(200, "text/html; charset=utf-8", PAGE.encode())
        elif self.path.startswith("/out/"):
            fn = os.path.join(OUT, os.path.basename(self.path[5:].split("?")[0]))
            if os.path.exists(fn):
                with open(fn, "rb") as f: self._send(200, "image/png", f.read())
            else: self._send(404, "text/plain", b"not found")
        elif self.path.startswith("/api/status/"):
            job_id = self.path.split("/api/status/", 1)[1]
            j = JOBS.get(job_id)
            if j is None:
                self._send(404, "application/json", json.dumps({"status":"error","error":"unknown job"}).encode())
            else:
                self._send(200, "application/json", json.dumps(j).encode())
        else:
            self._send(404, "text/plain", b"not found")

    def do_POST(self):
        global _job_lock
        if self.path != "/api/transform":
            self._send(404, "text/plain", b"not found"); return

        if killed():
            self._send(503, "application/json", json.dumps({"ok":False,"error":"transforms are paused right now"}).encode()); return

        ip = self.client_address[0]
        now = time.time()
        if now - _last_by_ip.get(ip, 0) < RATE_WINDOW:
            wait = int(RATE_WINDOW - (now - _last_by_ip.get(ip, 0)))
            self._send(429, "application/json", json.dumps({"ok":False,"error":"one at a time - try again in %ds" % wait}).encode()); return

        if not _job_lock.acquire(blocking=False):
            self._send(503, "application/json", json.dumps({"ok":False,"error":"forge's busy with someone else, try again shortly"}).encode()); return

        try:
            n = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(n)
            photo = parse_multipart_photo(self.headers.get('Content-Type', ''), body)
        except Exception as e:
            _job_lock.release()
            self._send(200, "application/json", json.dumps({"ok":False,"error":str(e)}).encode()); return

        _last_by_ip[ip] = now
        job_id = uuid.uuid4().hex
        JOBS[job_id] = {"status":"running", "url":None, "error":None}
        threading.Thread(target=run_job, args=(job_id, photo), daemon=True).start()
        self._send(200, "application/json", json.dumps({"ok":True,"job":job_id}).encode())

    def log_message(self, *a): pass

if __name__ == "__main__":
    os.makedirs(OUT, exist_ok=True)
    print("AI Transform demo (LOCAL TEST ONLY) -> http://127.0.0.1:%d" % PORT)
    print("(ComfyUI must be running at %s)" % COMFY)
    print("touch kill.on next to this script to pause it instantly")
    ThreadingHTTPServer(("127.0.0.1", PORT), H).serve_forever()
