#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""cloud-generate.py —— 走云端文生图 API 出图（只依赖 Python 标准库）

用法:
    python cloud-generate.py "提示词" 输出.png [尺寸] [模型]
                             [--endpoint URL] [--key-env 环境变量名] [--watermark]

默认值（都可用参数覆盖）:
    endpoint      https://ark.cn-beijing.volces.com/api/v3/images/generations  （火山方舟 / seedream）
    尺寸          2048x2048
    模型          doubao-seedream-4-5-251128
    key 环境变量   ARK_API_KEY

★ 四条来自实战的提醒:
  1) **API key 一律从环境变量读** —— 不写进脚本，也不去读别人的私有凭据文件。
  2) ★★ **返回的图片链接通常只有 24 小时有效期** —— 所以本脚本**拿到响应立刻下载落盘**；
     只把 URL 存进数据库的话，隔天就是 404。
  3) **水印默认是开的** —— 要干净素材就显式传 `watermark: false`（本脚本**默认关水印**，
     需要水印时加 `--watermark`）。⚠️ 这个参数必须是**布尔值**，传字符串 "false" 会被当成真。
  4) 提示词**别写太长** —— 实测超长提示词的后果是"**丢元素**"（而且每次丢的不一样），
     不是"慢慢变糊"，极难排查。建议控制在一个段落以内。
"""
import json
import os
import sys
import urllib.request

ENDPOINT = "https://ark.cn-beijing.volces.com/api/v3/images/generations"
KEY_ENV = "ARK_API_KEY"
SIZE = "2048x2048"
MODEL = "doubao-seedream-4-5-251128"


def generate(prompt, out, size, model, endpoint, key, watermark):
    payload = {
        "model": model,
        "prompt": prompt,
        "size": size,
        "response_format": "url",
        "watermark": bool(watermark),          # ★ 必须是布尔，不能是字符串
    }
    req = urllib.request.Request(
        endpoint,
        data=json.dumps(payload).encode(),
        headers={"Authorization": "Bearer " + key, "Content-Type": "application/json"})
    resp = json.loads(urllib.request.urlopen(req, timeout=180).read())

    url = resp["data"][0]["url"]
    # ★ 立刻落盘：这个链接会过期
    img = urllib.request.urlopen(url, timeout=120).read()
    with open(out, "wb") as f:
        f.write(img)
    print("saved: %s (%d bytes)  model=%s  size=%s  watermark=%s"
          % (out, len(img), model, size, watermark))


def main():
    args = sys.argv[1:]
    opts, positional = {}, []
    i = 0
    while i < len(args):
        if args[i] == "--watermark":           # 无值开关：默认关，加它才开
            opts["watermark"] = True
            i += 1
        elif args[i].startswith("--"):
            opts[args[i][2:]] = args[i + 1] if i + 1 < len(args) else ""
            i += 2
        else:
            positional.append(args[i])
            i += 1

    if len(positional) < 2:
        print(__doc__)
        sys.exit(2)

    key_env = opts.get("key-env", KEY_ENV)
    key = os.environ.get(key_env, "").strip()
    if not key:
        print("缺少 API key：请先设置环境变量 %s" % key_env)
        sys.exit(3)

    prompt, out = positional[0], positional[1]
    size = positional[2] if len(positional) > 2 else SIZE
    model = positional[3] if len(positional) > 3 else MODEL
    generate(prompt, out, size, model,
             opts.get("endpoint", ENDPOINT), key, opts.get("watermark", False))


if __name__ == "__main__":
    main()
