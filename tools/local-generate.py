#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""local-generate.py —— 直连本地 ComfyUI 出图（只依赖 Python 标准库）

用法:
    python local-generate.py "提示词" 输出.png [宽] [高] [seed]
                              [--server URL] [--ckpt 文件名] [--prefix 前缀]

环境变量（命令行参数优先）:
    COMFYUI_URL      ComfyUI 地址        默认 http://127.0.0.1:8188
    COMFYUI_CKPT     主模型文件名        默认 Illustrious-XL-v0.1.safetensors
    COMFYUI_PREFIX   输出文件名前缀      默认 img

原理: 向 ComfyUI 的 /prompt 接口提交一份工作流 → 轮询 /history/<id> → 从 /view 下载图片落盘。
      零第三方依赖（只用 urllib / json / uuid）。

★ 两个来自实战的默认值选择:
  1) **默认走 fp16 主模型，不走量化版（GGUF）** —— 量化路径实测出图明显发糊
     （清晰度指标 4，而 fp16 是 16）。慢一点没关系，糊了才是白跑。
  2) **输出文件名带前缀** —— 覆盖同名文件时，很多前端会显示缓存的旧图，
     所以重出时请换前缀或加时间戳。
"""
import json
import os
import sys
import time
import uuid
import urllib.request

SERVER = os.environ.get("COMFYUI_URL", "http://127.0.0.1:8188").rstrip("/")
CKPT = os.environ.get("COMFYUI_CKPT", "Illustrious-XL-v0.1.safetensors")
PREFIX = os.environ.get("COMFYUI_PREFIX", "img")

# 负面词：这一组是按"二次元 + 国风"调的（含"不要和服/不要西式建筑"这类风格红线）。
# 换风格时**改这里**，而不是在提示词里写"不要 XXX"—— 经验：越强调越容易生成出来。
NEG = (
    "blurry face, deformed face, disfigured, bad anatomy, bad hands, missing fingers, extra limbs, "
    "worst quality, low quality, jpeg artifacts, watermark, text, signature, "
    "western gothic architecture, european castle, cathedral, japanese style, kimono, "
    "western clothes, modern clothes, photo, realistic photo"
)
# 正面画质前缀
QUALITY = "masterpiece, best quality, very aesthetic, absurdres"


def build_workflow(prompt, w, h, seed, ckpt):
    """一份最小可用的 SDXL 文生图工作流（节点 id 用 1..9，语义见 ComfyUI 默认工作流）。"""
    return {
        "1": {"class_type": "CheckpointLoaderSimple", "inputs": {"ckpt_name": ckpt}},
        "4": {"class_type": "CLIPTextEncode", "inputs": {"text": QUALITY + ", " + prompt, "clip": ["1", 1]}},
        "5": {"class_type": "CLIPTextEncode", "inputs": {"text": NEG, "clip": ["1", 1]}},
        "6": {"class_type": "EmptyLatentImage", "inputs": {"width": w, "height": h, "batch_size": 1}},
        "7": {"class_type": "KSampler", "inputs": {
            "model": ["1", 0], "positive": ["4", 0], "negative": ["5", 0], "latent_image": ["6", 0],
            "seed": seed, "steps": 28, "cfg": 6.0,
            "sampler_name": "euler", "scheduler": "normal", "denoise": 1.0}},
        "8": {"class_type": "VAEDecode", "inputs": {"samples": ["7", 0], "vae": ["1", 2]}},
        "9": {"class_type": "SaveImage", "inputs": {"images": ["8", 0], "filename_prefix": PREFIX}},
    }


def submit(workflow):
    body = json.dumps({"prompt": workflow, "client_id": uuid.uuid4().hex}).encode()
    req = urllib.request.Request(SERVER + "/prompt", data=body,
                                headers={"Content-Type": "application/json"})
    return json.loads(urllib.request.urlopen(req, timeout=30).read()).get("prompt_id")


def fetch(prompt_id, out, timeout_s=600):
    """轮询 history，拿到图就下载落盘。"""
    t0 = time.time()
    while time.time() - t0 < timeout_s:
        time.sleep(2)
        try:
            hist = json.loads(urllib.request.urlopen(SERVER + "/history/" + prompt_id, timeout=10).read())
        except Exception:
            continue                      # 服务端偶尔忙，继续等
        if prompt_id not in hist:
            continue
        for node in hist[prompt_id].get("outputs", {}).values():
            for img in node.get("images", []):
                url = "%s/view?filename=%s&subfolder=%s&type=%s" % (
                    SERVER, img["filename"], img.get("subfolder", ""), img.get("type", "output"))
                data = urllib.request.urlopen(url, timeout=120).read()
                with open(out, "wb") as f:
                    f.write(data)
                print("saved: %s (%d bytes)" % (out, len(data)))
                return True
        print("完成但没取到图（检查工作流输出节点）")
        return False
    print("超时（%ds）：出图进程可能卡住；同时确认显卡没有被别的程序占用" % timeout_s)
    return False


def main():
    args = [a for a in sys.argv[1:]]
    opts = {}
    positional = []
    i = 0
    while i < len(args):
        if args[i].startswith("--"):
            opts[args[i][2:]] = args[i + 1] if i + 1 < len(args) else ""
            i += 2
        else:
            positional.append(args[i])
            i += 1

    if len(positional) < 2:
        print(__doc__)
        sys.exit(2)

    global SERVER, CKPT, PREFIX
    if "server" in opts:
        SERVER = opts["server"].rstrip("/")
    if "ckpt" in opts:
        CKPT = opts["ckpt"]
    if "prefix" in opts:
        PREFIX = opts["prefix"]

    prompt, out = positional[0], positional[1]
    w = int(positional[2]) if len(positional) > 2 else 832
    h = int(positional[3]) if len(positional) > 3 else 1216
    seed = int(positional[4]) if len(positional) > 4 else (uuid.uuid4().int & 0xFFFFFFFF)

    print("server=%s  ckpt=%s  %dx%d  seed=%d" % (SERVER, CKPT, w, h, seed))
    pid = submit(build_workflow(prompt, w, h, seed, CKPT))
    print("prompt_id:", pid)
    sys.exit(0 if fetch(pid, out) else 1)


if __name__ == "__main__":
    main()
