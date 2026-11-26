# Private Qwen test

The initial GitHub Qwen benchmark used synthetic documents; do not commit actual supplier photos or secrets into this public repository.

On a PC with Ollama and Python installed:

```sh
ollama pull qwen3-vl:2b-instruct
python vision-lab/local_qwen.py --self-test
python vision-lab/local_qwen.py /path/to/invoice1.jpg /path/to/invoice2.jpg
```

The script calls only localhost, reads original photos locally and validates structured fields. No API key or per-request charge for local model inference. The quantized Ollama model is not identical to the Transformers benchmark; verify both actual photographs before considering deployment. This is a test adapter, not an Android integration. Do not expose the Ollama port on the public internet.
