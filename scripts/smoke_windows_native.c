#include <windows.h>

typedef ULONGLONG(__cdecl *count_tokens_fn)(const BYTE *, SIZE_T);
typedef DWORD(__cdecl *last_error_fn)(void);

static void write_message(DWORD stream, const char *message, DWORD length) {
  DWORD written = 0;
  WriteFile(GetStdHandle(stream), message, length, &written, NULL);
}

void WINAPI mainCRTStartup(void) {
  static const char load_failure[] = "could not load bun_nltk.dll\n";
  static const char export_failure[] = "required bun_nltk exports are missing\n";
  static const char result_failure[] = "Windows native smoke result mismatch\n";
  static const char success[] =
      "{\"ok\":true,\"platform\":\"win32-x64-wine\",\"tokens\":9,"
      "\"last_error_code\":0}\n";
  static const BYTE text[] =
      "Dr. Smith built 3 models. They were running quickly.";

  HMODULE library = LoadLibraryA("bun_nltk.dll");
  if (library == NULL) {
    write_message(STD_ERROR_HANDLE, load_failure, sizeof(load_failure) - 1);
    ExitProcess(2);
  }

  count_tokens_fn count_tokens =
      (count_tokens_fn)(void *)GetProcAddress(library, "bunnltk_count_tokens_ascii");
  last_error_fn last_error =
      (last_error_fn)(void *)GetProcAddress(library, "bunnltk_last_error_code");
  if (count_tokens == NULL || last_error == NULL) {
    write_message(STD_ERROR_HANDLE, export_failure, sizeof(export_failure) - 1);
    FreeLibrary(library);
    ExitProcess(3);
  }

  if (count_tokens(text, sizeof(text) - 1) != 9 || last_error() != 0) {
    write_message(STD_ERROR_HANDLE, result_failure, sizeof(result_failure) - 1);
    FreeLibrary(library);
    ExitProcess(4);
  }

  write_message(STD_OUTPUT_HANDLE, success, sizeof(success) - 1);
  FreeLibrary(library);
  ExitProcess(0);
}
