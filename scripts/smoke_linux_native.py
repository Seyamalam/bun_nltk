from __future__ import annotations

import ctypes
import json
import pathlib
import sys
import tarfile
import tempfile


def main() -> None:
    if len(sys.argv) != 2:
        raise SystemExit("usage: smoke_linux_native.py <package.tgz>")

    package_path = pathlib.Path(sys.argv[1])
    member_name = "package/native/prebuilt/linux-x64/bun_nltk.so"
    with tarfile.open(package_path, "r:gz") as archive:
        names = set(archive.getnames())
        required = {
            member_name,
            "package/native/prebuilt/darwin-arm64/bun_nltk.dylib",
            "package/native/prebuilt/win32-x64/bun_nltk.dll",
            "package/native/bun_nltk.wasm",
        }
        missing = sorted(required - names)
        if missing:
            raise RuntimeError(f"missing packaged artifacts: {missing}")
        source = archive.extractfile(member_name)
        if source is None:
            raise RuntimeError(f"could not read {member_name}")
        with tempfile.TemporaryDirectory(prefix="bun-nltk-linux-smoke-") as temp_dir:
            library_path = pathlib.Path(temp_dir) / "bun_nltk.so"
            library_path.write_bytes(source.read())
            library = ctypes.CDLL(str(library_path))
            count_tokens = library.bunnltk_count_tokens_ascii
            count_tokens.argtypes = [ctypes.c_void_p, ctypes.c_size_t]
            count_tokens.restype = ctypes.c_uint64
            text = b"Dr. Smith built 3 models. They were running quickly."
            tokens = int(count_tokens(text, len(text)))
            if tokens != 9:
                raise RuntimeError(f"Linux native token count mismatch: {tokens} != 9")

    print(json.dumps({"ok": True, "platform": "linux-x64", "tokens": tokens}, indent=2))


if __name__ == "__main__":
    main()
